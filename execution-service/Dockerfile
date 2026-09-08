FROM gcc:13.4.0-bookworm

LABEL org.opencontainers.image.title="masria-cpp17-runner" \
      org.opencontainers.image.description="Isolated MASRIA C++17 job sandbox. Not a public API." \
      masria.runner.version="masria-cpp17-v1" \
      masria.gcc.version="13.4.0" \
      masria.cxx.standard="c++17"

COPY src/sandbox/supervisor.c /tmp/supervisor.c

RUN test -x /usr/local/bin/g++ \
 && /usr/local/bin/g++ -dumpfullversion | tee /etc/masria-gpp-version \
 && test "$(/usr/local/bin/g++ -dumpfullversion)" = "13.4.0" \
 && gcc -O2 -s -DMASRIA_COMPILER=\"/usr/local/bin/g++\" -o /usr/local/bin/masria-supervisor /tmp/supervisor.c \
 && rm -f /tmp/supervisor.c \
 && chmod 0755 /usr/local/bin/masria-supervisor

USER 65534:65534
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/masria-supervisor"]
