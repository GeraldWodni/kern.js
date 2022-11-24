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

### Optional
- `SYNC_INTERVAL`: interval in minutes to perform sync. Defaults to `60`.
  _Hint: is aligned to the hour. Interval 15 will perform at every quarter hour. Interval 120 will perform every 2nd hour on the clock._
  Run timetable.sh for some examples.

## Special files
- Dumps are expected to be named `$MARIADB_DATABASE.sql`.
- If `autosetup.sh` is provided in the reporitories root, it will be executed if no tables are found. First argument is the config file (`my.cnf`).
