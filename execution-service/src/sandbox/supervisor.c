#ifndef MASRIA_COMPILER
#define MASRIA_COMPILER "/usr/local/bin/g++"
#endif

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define MAGIC "MEX1"
#define MAX_SOURCE_BYTES 100000
#define MAX_OUTPUT_BYTES 65536
#define MAX_TIME_MS 10000
#define MAX_MEMORY_MB 256
#define COMPILE_TIME_MS 15000
#define WORKSPACE "/workspace"
#define SOURCE_PATH "/workspace/main.cpp"
#define PROGRAM_PATH "/workspace/program"

typedef struct {
  uint32_t time_limit_ms;
  uint32_t memory_limit_mb;
  uint32_t max_output_bytes;
  uint32_t source_len;
} JobHeader;

static uint64_t now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (uint64_t)ts.tv_sec * 1000ULL + (uint64_t)ts.tv_nsec / 1000000ULL;
}

static int read_full(int fd, void *buf, size_t n) {
  unsigned char *p = buf;
  size_t got = 0;
  while (got < n) {
    ssize_t r = read(fd, p + got, n - got);
    if (r == 0) return -1;
    if (r < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    got += (size_t)r;
  }
  return 0;
}

static int write_full(int fd, const void *buf, size_t n) {
  const unsigned char *p = buf;
  size_t sent = 0;
  while (sent < n) {
    ssize_t w = write(fd, p + sent, n - sent);
    if (w < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    sent += (size_t)w;
  }
  return 0;
}

static int valid_utf8(const unsigned char *s, size_t n) {
  size_t i = 0;
  while (i < n) {
    if (s[i] <= 0x7F) {
      i++;
      continue;
    }
    size_t need = 0;
    unsigned char c = s[i];
    if ((c & 0xE0) == 0xC0) need = 2;
    else if ((c & 0xF0) == 0xE0) need = 3;
    else if ((c & 0xF8) == 0xF0) need = 4;
    else return 0;
    if (i + need > n) return 0;
    for (size_t j = 1; j < need; j++) {
      if ((s[i + j] & 0xC0) != 0x80) return 0;
    }
    if (need == 2 && c < 0xC2) return 0;
    if (need == 3 && c == 0xE0 && s[i + 1] < 0xA0) return 0;
    if (need == 4 && c == 0xF0 && s[i + 1] < 0x90) return 0;
    if (need == 4 && c > 0xF4) return 0;
    if (need == 3 && c == 0xED && s[i + 1] >= 0xA0) return 0;
    i += need;
  }
  return 1;
}

static void json_escape_append(char **out, size_t *len, size_t *cap, const char *s, size_t n) {
  for (size_t i = 0; i < n; i++) {
    unsigned char c = (unsigned char)s[i];
    const char *rep = NULL;
    char tmp[8];
    size_t replen = 0;
    if (c == '\\') { rep = "\\\\"; replen = 2; }
    else if (c == '"') { rep = "\\\""; replen = 2; }
    else if (c == '\n') { rep = "\\n"; replen = 2; }
    else if (c == '\r') { rep = "\\r"; replen = 2; }
    else if (c == '\t') { rep = "\\t"; replen = 2; }
    else if (c < 0x20) {
      snprintf(tmp, sizeof(tmp), "\\u%04x", c);
      rep = tmp;
      replen = 6;
    } else {
      tmp[0] = (char)c;
      rep = tmp;
      replen = 1;
    }
    if (*len + replen + 1 > *cap) {
      *cap = (*cap + replen + 1024) * 2;
      char *next = realloc(*out, *cap);
      if (!next) _exit(2);
      *out = next;
    }
    memcpy(*out + *len, rep, replen);
    *len += replen;
  }
}

static void emit_report(
  const char *status,
  const char *failure,
  const char *stdout_s,
  size_t stdout_n,
  const char *stderr_s,
  size_t stderr_n,
  int exit_code,
  int signal_no,
  uint32_t elapsed_ms
) {
  char *buf = malloc(4096);
  size_t len = 0;
  size_t cap = 4096;
  if (!buf) _exit(2);
  const char *prefix = "{\"status\":\"";
  memcpy(buf, prefix, strlen(prefix));
  len = strlen(prefix);
  json_escape_append(&buf, &len, &cap, status, strlen(status));
  const char *mid1 = "\",\"failureReason\":\"";
  memcpy(buf + len, mid1, strlen(mid1));
  len += strlen(mid1);
  json_escape_append(&buf, &len, &cap, failure ? failure : "", failure ? strlen(failure) : 0);
  const char *mid2 = "\",\"stdout\":\"";
  memcpy(buf + len, mid2, strlen(mid2));
  len += strlen(mid2);
  json_escape_append(&buf, &len, &cap, stdout_s ? stdout_s : "", stdout_n);
  const char *mid3 = "\",\"stderr\":\"";
  memcpy(buf + len, mid3, strlen(mid3));
  len += strlen(mid3);
  json_escape_append(&buf, &len, &cap, stderr_s ? stderr_s : "", stderr_n);
  char tail[160];
  int n = snprintf(
    tail,
    sizeof(tail),
    "\",\"exitCode\":%d,\"signal\":%d,\"executionTimeMs\":%u}",
    exit_code,
    signal_no,
    elapsed_ms
  );
  if (n < 0) _exit(2);
  if (len + (size_t)n + 1 > cap) {
    cap = len + (size_t)n + 64;
    buf = realloc(buf, cap);
    if (!buf) _exit(2);
  }
  memcpy(buf + len, tail, (size_t)n);
  len += (size_t)n;
  write_full(STDOUT_FILENO, buf, len);
  write_full(STDOUT_FILENO, "\n", 1);
  free(buf);
}

static void apply_run_limits(uint32_t memory_mb, uint32_t cpu_seconds) {
  struct rlimit as;
  as.rlim_cur = as.rlim_max = (rlim_t)memory_mb * 1024ULL * 1024ULL;
  setrlimit(RLIMIT_AS, &as);
  struct rlimit cpu;
  cpu.rlim_cur = cpu.rlim_max = cpu_seconds < 1 ? 1 : cpu_seconds;
  setrlimit(RLIMIT_CPU, &cpu);
  struct rlimit nproc;
  nproc.rlim_cur = nproc.rlim_max = 8;
  setrlimit(RLIMIT_NPROC, &nproc);
  struct rlimit fsize;
  fsize.rlim_cur = fsize.rlim_max = 1024 * 1024;
  setrlimit(RLIMIT_FSIZE, &fsize);
  struct rlimit core;
  core.rlim_cur = core.rlim_max = 0;
  setrlimit(RLIMIT_CORE, &core);
}

static void kill_group(pid_t pid) {
  if (pid > 0) {
    kill(-pid, SIGKILL);
    kill(pid, SIGKILL);
  }
}

static int harvest(pid_t pid, int *exit_code, int *signal_no) {
  int status = 0;
  pid_t w;
  do {
    w = waitpid(pid, &status, 0);
  } while (w < 0 && errno == EINTR);
  if (w < 0) return -1;
  if (WIFEXITED(status)) {
    *exit_code = WEXITSTATUS(status);
    *signal_no = 0;
  } else if (WIFSIGNALED(status)) {
    *exit_code = 128 + WTERMSIG(status);
    *signal_no = WTERMSIG(status);
  }
  return 0;
}

static int drain_fd(int fd, char *buf, size_t cap, size_t *used, int *overflow) {
  char tmp[4096];
  ssize_t r = read(fd, tmp, sizeof(tmp));
  if (r < 0) {
    if (errno == EAGAIN || errno == EINTR) return 0;
    return -1;
  }
  if (r == 0) return 1;
  if (*used + (size_t)r > cap) {
    size_t room = cap > *used ? cap - *used : 0;
    if (room) memcpy(buf + *used, tmp, room);
    *used = cap;
    *overflow = 1;
  } else {
    memcpy(buf + *used, tmp, (size_t)r);
    *used += (size_t)r;
  }
  return 0;
}

static int run_command(
  char *const argv[],
  char *const envp[],
  uint32_t timeout_ms,
  uint32_t memory_mb,
  int apply_student_limits,
  char *out,
  size_t out_cap,
  size_t *out_n,
  char *err,
  size_t err_cap,
  size_t *err_n,
  int *exit_code,
  int *signal_no,
  int *output_overflow,
  uint32_t *elapsed_ms
) {
  int out_pipe[2];
  int err_pipe[2];
  if (pipe(out_pipe) < 0 || pipe(err_pipe) < 0) return -1;

  pid_t pid = fork();
  if (pid < 0) return -1;
  if (pid == 0) {
    setpgid(0, 0);
    dup2(out_pipe[1], STDOUT_FILENO);
    dup2(err_pipe[1], STDERR_FILENO);
    close(out_pipe[0]);
    close(out_pipe[1]);
    close(err_pipe[0]);
    close(err_pipe[1]);
    int nullfd = open("/dev/null", O_RDONLY);
    if (nullfd >= 0) {
      dup2(nullfd, STDIN_FILENO);
      close(nullfd);
    }
    if (chdir(WORKSPACE) != 0) _exit(127);
    if (apply_student_limits) {
      apply_run_limits(memory_mb, (timeout_ms + 999) / 1000);
    }
    execve(argv[0], argv, envp);
    _exit(127);
  }

  setpgid(pid, pid);
  close(out_pipe[1]);
  close(err_pipe[1]);
  fcntl(out_pipe[0], F_SETFL, O_NONBLOCK);
  fcntl(err_pipe[0], F_SETFL, O_NONBLOCK);

  uint64_t start = now_ms();
  int out_done = 0;
  int err_done = 0;
  *out_n = 0;
  *err_n = 0;
  *output_overflow = 0;
  int timed_out = 0;

  while (!out_done || !err_done) {
    uint64_t elapsed = now_ms() - start;
    if (elapsed >= timeout_ms) {
      timed_out = 1;
      kill_group(pid);
      break;
    }
    struct pollfd fds[2];
    int nfds = 0;
    if (!out_done) {
      fds[nfds].fd = out_pipe[0];
      fds[nfds].events = POLLIN;
      nfds++;
    }
    if (!err_done) {
      fds[nfds].fd = err_pipe[0];
      fds[nfds].events = POLLIN;
      nfds++;
    }
    int wait_ms = (int)(timeout_ms - elapsed);
    if (wait_ms < 1) wait_ms = 1;
    int pr = poll(fds, nfds, wait_ms);
    if (pr < 0) {
      if (errno == EINTR) continue;
      break;
    }
    for (int i = 0; i < nfds; i++) {
      if (!(fds[i].revents & (POLLIN | POLLHUP | POLLERR))) continue;
      int is_out = fds[i].fd == out_pipe[0];
      int closed = drain_fd(
        fds[i].fd,
        is_out ? out : err,
        is_out ? out_cap : err_cap,
        is_out ? out_n : err_n,
        output_overflow
      );
      if (closed == 1 || (fds[i].revents & POLLHUP)) {
        if (is_out) out_done = 1;
        else err_done = 1;
      }
    }
    if (*output_overflow) {
      kill_group(pid);
      break;
    }
  }

  if (timed_out || *output_overflow) {
    kill_group(pid);
  }
  harvest(pid, exit_code, signal_no);
  close(out_pipe[0]);
  close(err_pipe[0]);
  *elapsed_ms = (uint32_t)(now_ms() - start);
  if (timed_out && *signal_no == 0) *signal_no = SIGKILL;
  return timed_out ? 1 : 0;
}

int main(void) {
  umask(0077);
  if (chdir(WORKSPACE) != 0) return 2;

  char magic[4];
  if (read_full(STDIN_FILENO, magic, 4) < 0 || memcmp(magic, MAGIC, 4) != 0) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "invalid protocol", 16, -1, 0, 0);
    return 0;
  }

  uint32_t fields[4];
  if (read_full(STDIN_FILENO, fields, sizeof(fields)) < 0) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "truncated header", 16, -1, 0, 0);
    return 0;
  }

  JobHeader header;
  header.time_limit_ms = ntohl(fields[0]);
  header.memory_limit_mb = ntohl(fields[1]);
  header.max_output_bytes = ntohl(fields[2]);
  header.source_len = ntohl(fields[3]);

  if (header.time_limit_ms == 0 || header.time_limit_ms > MAX_TIME_MS) header.time_limit_ms = MAX_TIME_MS;
  if (header.memory_limit_mb == 0 || header.memory_limit_mb > MAX_MEMORY_MB) header.memory_limit_mb = MAX_MEMORY_MB;
  if (header.max_output_bytes == 0 || header.max_output_bytes > MAX_OUTPUT_BYTES) {
    header.max_output_bytes = MAX_OUTPUT_BYTES;
  }
  if (header.source_len == 0 || header.source_len > MAX_SOURCE_BYTES) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "invalid source length", 21, -1, 0, 0);
    return 0;
  }

  unsigned char *source = malloc(header.source_len);
  if (!source) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "oom", 3, -1, 0, 0);
    return 0;
  }
  if (read_full(STDIN_FILENO, source, header.source_len) < 0) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "truncated source", 16, -1, 0, 0);
    return 0;
  }
  if (!valid_utf8(source, header.source_len)) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "source is not utf-8", 19, -1, 0, 0);
    return 0;
  }

  int fd = open(SOURCE_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (fd < 0 || write_full(fd, source, header.source_len) < 0) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "write source failed", 19, -1, 0, 0);
    return 0;
  }
  close(fd);
  free(source);

  char *const compile_argv[] = {
    MASRIA_COMPILER,
    "-std=c++17",
    "-O2",
    "-pipe",
    "-fPIE",
    "-o",
    PROGRAM_PATH,
    SOURCE_PATH,
    NULL
  };
  char *const compile_env[] = {
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "HOME=/workspace",
    "LANG=C",
    "LC_ALL=C",
    NULL
  };

  char compile_out[MAX_OUTPUT_BYTES];
  char compile_err[MAX_OUTPUT_BYTES];
  size_t cout_n = 0;
  size_t cerr_n = 0;
  int exit_code = 0;
  int signal_no = 0;
  int overflow = 0;
  uint32_t elapsed = 0;
  int timed_out = run_command(
    compile_argv,
    compile_env,
    COMPILE_TIME_MS,
    header.memory_limit_mb,
    0,
    compile_out,
    sizeof(compile_out),
    &cout_n,
    compile_err,
    sizeof(compile_err),
    &cerr_n,
    &exit_code,
    &signal_no,
    &overflow,
    &elapsed
  );
  if (timed_out == 1) {
    emit_report("FAILED", "TIME_LIMIT", "", 0, compile_err, cerr_n, exit_code, signal_no, elapsed);
    return 0;
  }
  if (timed_out < 0) {
    emit_report("FAILED", "SYSTEM_ERROR", "", 0, "compile spawn failed", 20, -1, 0, elapsed);
    return 0;
  }
  if (exit_code != 0 || signal_no != 0) {
    emit_report("FAILED", "COMPILE_ERROR", compile_out, cout_n, compile_err, cerr_n, exit_code, signal_no, elapsed);
    return 0;
  }

  char *const run_argv[] = { PROGRAM_PATH, NULL };
  char *const run_env[] = {
    "PATH=/usr/bin:/bin",
    "HOME=/workspace",
    "LANG=C",
    "LC_ALL=C",
    NULL
  };
  char run_out[MAX_OUTPUT_BYTES];
  char run_err[MAX_OUTPUT_BYTES];
  size_t rout_n = 0;
  size_t rerr_n = 0;
  exit_code = 0;
  signal_no = 0;
  overflow = 0;
  elapsed = 0;
  timed_out = run_command(
    run_argv,
    run_env,
    header.time_limit_ms,
    header.memory_limit_mb,
    1,
    run_out,
    header.max_output_bytes < MAX_OUTPUT_BYTES ? header.max_output_bytes : MAX_OUTPUT_BYTES,
    &rout_n,
    run_err,
    header.max_output_bytes < MAX_OUTPUT_BYTES ? header.max_output_bytes : MAX_OUTPUT_BYTES,
    &rerr_n,
    &exit_code,
    &signal_no,
    &overflow,
    &elapsed
  );

  if (overflow) {
    emit_report("FAILED", "OUTPUT_LIMIT", run_out, rout_n, run_err, rerr_n, exit_code, signal_no, elapsed);
    return 0;
  }
  if (timed_out == 1 || signal_no == SIGXCPU) {
    emit_report("FAILED", "TIME_LIMIT", run_out, rout_n, run_err, rerr_n, exit_code, signal_no, elapsed);
    return 0;
  }
  if (signal_no == SIGKILL && elapsed + 50 < header.time_limit_ms) {
    emit_report("FAILED", "MEMORY_LIMIT", run_out, rout_n, run_err, rerr_n, exit_code, signal_no, elapsed);
    return 0;
  }
  if (signal_no != 0 || exit_code != 0) {
    emit_report("FAILED", "RUNTIME_ERROR", run_out, rout_n, run_err, rerr_n, exit_code, signal_no, elapsed);
    return 0;
  }

  emit_report("COMPLETED", "", run_out, rout_n, run_err, rerr_n, exit_code, 0, elapsed);
  return 0;
}
