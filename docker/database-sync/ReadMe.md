# Dockerfile "database-sync"
Checking out and synching a database every 15 minutes.
Imports database dump on launch if no tables are found.

## Environment variables
### Required
- `MARIADB_DATABASE`: database name
- `REPOSITORY`: git URL i.e. `git@example.com:example.org`
- `GIT_NAME`: git config `user.name` i.e. `database-syncer`
- `GIT_EMAIL`: git config `user.email` i.e. `auto@example.com`
- `MARIADB_DUMPER_USER`: user used for dumping and restoring the database
- `MARIADB_DUMPER_PASSWORD`: password for `MARIADB_DUMPER_USER`


## Special files
- Dumps are expected to be named `$MARIADB_DATABASE.sql`.
- If `autosetup.sh` is provided in the reporitories root, it will be executed if no tables are found. First argument is the config file (`my.cnf`).
