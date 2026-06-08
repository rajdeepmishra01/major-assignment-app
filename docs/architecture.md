# Architecture

The app uses a microservice architecture.

```text
React Frontend
  |-- Auth Service: register/login/JWT
  |-- Todo Service: protected todo CRUD
          |
      PostgreSQL
```

The Auth Service owns user registration and login. The Todo Service does not manage passwords. It only trusts JWT tokens signed using the shared JWT secret.
