# MASRIA Deployment Guide

## Environment Variables

### Firebase Configuration (Required)

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY="your-masria-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="masria-16b8f.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="masria-16b8f"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="masria-16b8f.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="808390544358"
NEXT_PUBLIC_FIREBASE_APP_ID="1:808390544358:web:e12bc18d55eb12983fe427"
```

### Firebase Admin SDK (Required for Coding Submissions)

The Firebase Admin SDK is required for the coding submission API to write authoritative evaluations and progress to Firestore.

```env
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"masria-16b8f","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**How to get the service account JSON:**

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the entire contents and paste it as a single-line string in `.env.local`
5. Make sure to wrap it in single quotes to handle line breaks

**Security Note:** Never commit the service account JSON to version control. Add `.env.local` to `.gitignore`.

### Execution Service Configuration (Required for Coding Submissions)

The execution service is a separate Docker-based service that runs student code in isolated containers.

```env
EXECUTION_SERVICE_URL="http://localhost:3001"
MASRIA_EXECUTION_SERVICE_TOKEN="your-secret-service-token-min-16-chars"
```

**For local development:**
- Start the execution service with `cd execution-service && docker-compose up`
- The service will be available at `http://localhost:3001`
- Set `MASRIA_EXECUTION_SERVICE_TOKEN` to match the value in `execution-service/docker-compose.yml`

**For production deployment:**
- Deploy the execution service to a separate server or container
- Update `EXECUTION_SERVICE_URL` to point to the production execution service
- Use a strong, randomly generated token for `MASRIA_EXECUTION_SERVICE_TOKEN`

## Deployment Steps

### 1. Prepare Environment Variables

Create `.env.local` with all required variables from above.

### 2. Build the Application

```bash
npm run build
```

### 3. Test Locally

```bash
npm run start
```

Visit `http://localhost:3000` to verify:
- Authentication works
- Student/parent/teacher dashboards load
- Coding challenges can be submitted (if execution service is running)

### 4. Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add all environment variables in Vercel dashboard:
   - All `NEXT_PUBLIC_FIREBASE_*` variables
   - `FIREBASE_SERVICE_ACCOUNT_JSON`
   - `EXECUTION_SERVICE_URL`
   - `MASRIA_EXECUTION_SERVICE_TOKEN`
4. Deploy

### 5. Deploy Execution Service (Separate)

The execution service should be deployed separately:

**Option A: Docker on VPS**
```bash
cd execution-service
docker-compose up -d
```

**Option B: Cloud Run / Container Service**
- Build the Docker image
- Push to container registry
- Deploy to your preferred container service
- Update `EXECUTION_SERVICE_URL` in Next.js environment

### 6. Deploy Firestore Rules

```bash
firebase login
firebase use masria-16b8f
firebase deploy --only firestore:rules
```

### 7. Verify Deployment

- Test authentication flow
- Test student signup and approval
- Test parent linking
- Test lesson viewing
- Test coding challenge submission (requires execution service)
- Verify Firestore rules are working

## Production Checklist

- [ ] All environment variables set in production
- [ ] Firebase service account has necessary permissions
- [ ] Execution service is deployed and accessible
- [ ] Firestore rules are deployed
- [ ] Firebase indexes are deployed (if needed)
- [ ] HTTPS is enabled
- [ ] Domain is added to Firebase Authentication authorized domains
- [ ] Teacher email allowlist is correct
- [ ] Execution service token is strong and secure
- [ ] CORS is configured if needed
- [ ] Monitoring/logging is set up

## Troubleshooting

### Coding Submissions Fail

1. Check that execution service is running: `curl http://your-execution-service-url/health`
2. Verify `EXECUTION_SERVICE_URL` is correct
3. Verify `MASRIA_EXECUTION_SERVICE_TOKEN` matches execution service
4. Check server logs for execution service errors

### Firebase Admin SDK Errors

1. Verify `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON
2. Ensure service account has Firestore write permissions
3. Check that project ID matches your Firebase project

### Build Errors

1. Ensure all dependencies are installed: `npm install`
2. Check TypeScript errors: `npm run build`
3. Verify execution-service is excluded from main tsconfig

## Security Notes

- Never commit `.env.local` or service account keys
- Use strong, randomly generated tokens for service-to-service communication
- Keep execution service behind a firewall or private network
- Regularly rotate service tokens
- Monitor execution service logs for suspicious activity
- Ensure Firestore rules deny all unspecified reads/writes
