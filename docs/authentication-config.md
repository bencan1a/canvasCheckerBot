# Open WebUI Authentication Configuration

This document explains how to configure Open WebUI authentication for different environments in the Canvas Checker Bot project.

## Overview

The project supports environment-based authentication configuration, allowing you to:
- Disable authentication for development environments
- Enable secure authentication for production environments
- Control user registration and default roles

## Environment Variables

### Required Variables

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `WEBUI_AUTH` | Enable/disable authentication | `true` | `true`, `false` |
| `WEBUI_SECRET_KEY` | Secret key for JWT tokens | `canvasbot-secret-key` | Any secure string |
| `ENABLE_SIGNUP` | Allow new user registration | `true` | `true`, `false` |
| `DEFAULT_USER_ROLE` | Default role for new users | `user` | `admin`, `user`, `pending` |

### Configuration Examples

#### Development Environment (No Authentication)
```bash
# .env file
WEBUI_AUTH=false
ENABLE_SIGNUP=false
DEFAULT_USER_ROLE=admin
WEBUI_SECRET_KEY=dev-secret-key
```

#### Production Environment (With Authentication)
```bash
# .env file
WEBUI_AUTH=true
WEBUI_SECRET_KEY=your-secure-random-key-here-change-this
ENABLE_SIGNUP=true
DEFAULT_USER_ROLE=user
```

## Setup Instructions

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Edit Configuration
Edit the `.env` file with your desired settings:

```bash
# For development (no auth)
WEBUI_AUTH=false

# For production (with auth)
WEBUI_AUTH=true
WEBUI_SECRET_KEY=generate-a-secure-key-here
```

### 3. Restart Services
```bash
npm run canvasbot:webui:restart
```

## Important Notes

### Authentication Disable Limitations
- **Fresh Installation Only**: `WEBUI_AUTH=false` only works on fresh installations without existing users
- **Data Persistence**: If you have existing user data, you must clear the WebUI volume to disable auth
- **Security Warning**: Never disable authentication in production environments

### Secret Key Security
- Use a strong, randomly generated secret key for production
- Change the default secret key before deploying
- Keep secret keys secure and never commit them to version control

### User Roles
- `admin`: Full administrative access to the WebUI
- `user`: Standard user access with limited administrative features
- `pending`: Requires admin approval before accessing the system

## Troubleshooting

### Cannot Disable Authentication
If `WEBUI_AUTH=false` doesn't work:

1. **Check for existing users**: Authentication can only be disabled on fresh installations
2. **Clear WebUI data**: Remove the Docker volume to start fresh
   ```bash
   docker-compose down
   docker volume rm canvascheckerbotproject_webui-data
   docker-compose up -d
   ```

### Authentication Not Working
If users cannot log in:

1. **Verify environment variables**: Check that `WEBUI_AUTH=true` and `WEBUI_SECRET_KEY` is set
2. **Check secret key**: Ensure the secret key is consistent across restarts
3. **Review logs**: Check WebUI container logs for authentication errors
   ```bash
   docker-compose logs canvasbot-webui
   ```

### User Registration Issues
If users cannot register:

1. **Check ENABLE_SIGNUP**: Ensure `ENABLE_SIGNUP=true`
2. **Verify default role**: Check `DEFAULT_USER_ROLE` is set to valid value
3. **Admin approval**: If using `pending` role, admin must approve new users

## Security Best Practices

### Development
- Use `WEBUI_AUTH=false` only in isolated development environments
- Never expose development instances to public networks
- Consider using `ENABLE_SIGNUP=false` to prevent unwanted registrations

### Production
- Always use `WEBUI_AUTH=true` in production
- Generate a strong, unique `WEBUI_SECRET_KEY`
- Set `ENABLE_SIGNUP=false` if you want to control user access manually
- Use `DEFAULT_USER_ROLE=pending` for manual user approval
- Regularly rotate secret keys
- Monitor authentication logs for suspicious activity

## Testing Configuration

### Verify Authentication Status
1. Access the WebUI at http://localhost:3000
2. **With Auth Enabled**: Should show login/registration forms
3. **With Auth Disabled**: Should directly access the interface

### Test User Registration
1. Set `ENABLE_SIGNUP=true`
2. Access registration page
3. Create test user account
4. Verify role assignment matches `DEFAULT_USER_ROLE`

### Test Secret Key Changes
1. Change `WEBUI_SECRET_KEY` in `.env`
2. Restart services
3. Verify existing sessions are invalidated
4. Test new login works with new key

## Related Files

- [`docker-compose.yml`](../docker-compose.yml) - Service configuration with environment variables
- [`.env.example`](../.env.example) - Environment template with example values
- [`package.json`](../package.json) - npm scripts for managing services