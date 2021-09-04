# Dockerfile "website-sync"
Checking out and synching a website every 15 minutes

## Environment variables
### Required
- `WEBSITE`: FQDN of website i.e. `example.org`
- `REPOSITORY`: git URL i.e. `git@example.com:example.org`
- `GIT_NAME`: git config `user.name` i.e. `website-syncer`
- `GIT_EMAIL`: git config `user.email` i.e. `auto@example.com`

### Optional
- `SYNC_USERS`: if `true` users are loaded from and saved into users.json (default: `false`)
- `SYNC_DISABLED`: if `true` interval syncing is disabled (default: `false`)
- `PRIVATE_REPO`: git URL for 2nd repository mounted under /private inside `REPOSITORY` (default: _empty_).
