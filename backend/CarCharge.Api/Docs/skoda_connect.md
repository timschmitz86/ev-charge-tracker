# Škoda Connect integration

The backend can retrieve the current odometer directly from the Škoda Connect Public API.
The API key is sent only in the `X-API-Key` request header and is never written to logs.

Enable the provider with environment variables (use a secret store in production):

```dotenv
VEHICLE_INTEGRATION_ENABLED=true
VEHICLE_INTEGRATION_PROVIDER=skoda_connect
SKODA_CONNECT_API_KEY=YOUR_KEY
SKODA_CONNECT_VIN=YOUR_VIN
```

`SKODA_CONNECT_BASE_URL` may be set to override the default
`https://public.api.connect.skoda-auto.cz`. The API permits 20 requests per VIN per hour;
the provider retries rate-limit and server errors up to two times, honoring `Retry-After`
when supplied. Authentication, authorization, and other non-transient errors return no
mileage and are logged without credentials or the full VIN.
