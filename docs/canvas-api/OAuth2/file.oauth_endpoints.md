# OAuth2 Endpoints

{% hint style="warning" %}
**Welcome to Our New API Docs!** This is the new home for all things API (previously at [Canvas LMS REST API Documentation](https://api.instructure.com)).
{% endhint %}

## OAuth2 Endpoints

{% hint style="warning" %}
Developer keys issued after Oct 2015 generate tokens with a 1 hour expiration. Applications must use [refresh tokens](../file.oauth#using-refresh-tokens) to generate new access tokens.
{% endhint %}

* [GET login/oauth2/auth](#get-login-oauth2-auth)
* [POST login/oauth2/token](#post-login-oauth2-token)
* [DELETE login/oauth2/token](#delete-login-oauth2-token)
* [GET login/session\_token](#get-login-session-token)

### GET login/oauth2/auth <a href="#get-login-oauth2-auth" id="get-login-oauth2-auth"></a>

#### GET https://\<canvas-install-url>/login/oauth2/auth?client\_id=XXX\&response\_type=code\&redirect\_uri=https://example.com/oauth\_complete\&state=YYY\&scope=\<value\_1>%20\<value\_2>%20\<value\_n>

**Parameters**

| Parameter      | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| client\_id     | Required | The client id for your registered application.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| response\_type | Required | The type of OAuth2 response requested. The only currently supported value is `code`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| redirect\_uri  | Required | The URL where the user will be redirected after authorization. The domain of this URL must match the domain of the redirect\_uri stored on the developer key, or it must be a subdomain of that domain. For native applications, currently the only supported value is `urn:ietf:wg:oauth:2.0:oob`, signifying that the credentials will be retrieved out-of-band using an embedded browser or other functionality.                                                                                                                                                                                                                                                                                                                              |
| state          | Optional | Your application can pass Canvas an arbitrary piece of state in this parameter, which will be passed back to your application in Step 2. It's strongly encouraged that your application pass a unique identifier in the state parameter, and then verify in Step 2 that the state you receive back from Canvas is the same expected value. Failing to do this opens your application to the possibility of logging the wrong person in, as [described here](http://homakov.blogspot.com/2012/07/saferweb-most-common-oauth2.html).                                                                                                                                                                                                               |
| scope          | Optional | This can be used to specify what information the Canvas API access token will provide access to. Canvas API scopes may be found beneath their corresponding endpoints in the "resources" documentation pages. If the developer key does not require scopes and no scope parameter is specified, the access token will have access to all scopes. If the developer key does require scopes and no scope parameter is specified, Canvas will respond with "invalid\_scope." To successfully pass multiple scope values, the scope parameter is included once, with multiple values separated by spaces. Passing multiple scope parameters, as is common in other areas of Canvas, causes only the last value to be applied to the generated token. |
| purpose        | Optional | This can be used to help the user identify which instance of an application this token is for. For example, a mobile device application could provide the name of the device.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| force\_login   | Optional | Set to '1' if you want to force the user to enter their credentials, even if they're already logged into Canvas. By default, if a user already has an active Canvas web session, they will not be asked to re-enter their credentials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| unique\_id     | Optional | Set to the user's username to be populated in the login form in the event that the user must authenticate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| prompt         | Optional | If set to `none`, Canvas will immediately redirect to the `redirect_uri`. If the caller has a valid session with a "remember me" token or a token from a trusted Developer Key, the redirect will contain a `code=XYZ` param. If the caller has no session, the redirect will contain an `error=login_required` param. If the caller has a session, but no "remember me" or trusted token, the redirect will contain an `error=interaction_required` param.                                                                                                                                                                                                                                                                                      |

### POST login/oauth2/token <a href="#post-login-oauth2-token" id="post-login-oauth2-token"></a>

See [Section 4.1.3](http://tools.ietf.org/html/rfc6749#section-4.1.3) of the OAuth2 RFC for more information about this process.

#### POST /login/oauth2/token

**Parameters**

| Parameter               | Required                                                       | Description                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| grant\_type             | Required                                                       | Values currently supported: "authorization\_code", "refresh\_token", and "client\_credentials".                                                                                                            |
| client\_id              | Required for grant\_types: authorization\_code, refresh\_token | The client id for your registered application.                                                                                                                                                             |
| client\_secret          | Required for grant\_types: authorization\_code, refresh\_token | The client secret for your registered application.                                                                                                                                                         |
| redirect\_uri           | Required for grant\_types: authorization\_code, refresh\_token | If a redirect\_uri was passed to the initial request in step 1, the same redirect\_uri must be given here.                                                                                                 |
| code                    | Required for grant\_type: authorization\_code                  | Required if grant\_type is authorization\_code. The code you received in a redirect response.                                                                                                              |
| refresh\_token          | Required for grant\_type: refresh\_token                       | Required if grant\_type is refresh\_token. The refresh\_token you received in a redirect response.                                                                                                         |
| client\_assertion\_type | Required for grant\_type: client\_credentials                  | Currently the only supported value for this field is \`urn:ietf:params:oauth:client-assertion-type:jwt-bearer\`.                                                                                           |
| client\_assertion       | Required for grant\_type: client\_credentials                  | The signed jwt used to request an access token. Includes the value of Developer Key id as the sub claim of the jwt body. Should be signed by the private key of the stored public key on the DeveloperKey. |
| scope                   | Required for grant\_type: client\_credentials                  | A list of scopes to be granted to the token. Currently only IMS defined scopes may be used.                                                                                                                |

**Canvas API example responses**

For grant\_type of code or refresh\_token:

| Parameter      | Description                                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| access\_token  | The OAuth2 Canvas API access token.                                                                                                                                                                               |
| token\_type    | The type of token that is returned.                                                                                                                                                                               |
| user           | A JSON object of canvas user id and user name.                                                                                                                                                                    |
| refresh\_token | The OAuth2 refresh token.                                                                                                                                                                                         |
| expires\_in    | Seconds until the access token expires.                                                                                                                                                                           |
| canvas\_region | For hosted Canvas, the AWS region (e.g. us-east-1) in which the institution that provided this token resides. For local or open source Canvas, this will have a value of "unknown". This field is safe to ignore. |

When using grant\_type=code (ex: for Canvas API access):

```
  {
    "access_token": "1/fFAGRNJru1FTz70BzhT3Zg",
    "token_type": "Bearer",
    "user": {"id":42, "name": "Jimi Hendrix"},
    "refresh_token": "tIh2YBWGiC0GgGRglT9Ylwv2MnTvy8csfGyfK2PqZmkFYYqYZ0wui4tzI7uBwnN2",
    "expires_in": 3600,
    "canvas_region": "us-east-1"
  }
  
```

When using grant\_type=refresh\_token, the response will not contain a new refresh token since the same refresh token can be used multiple times:

```
  {
    "access_token": "1/fFAGRNJru1FTz70BzhT3Zg",
    "token_type": "Bearer",
    "user": {"id":42, "name": "Jimi Hendrix"},
    "expires_in": 3600
  }
  
```

If scope=/auth/userinfo was specified in the [GET login/oauth2/auth](https://github.com/instructure/api-docu-portal/blob/prod/gitbook/services/canvas/file.oauth_endpoints.html#get-login-oauth2-auth) request (ex: when using Canvas as an authentication service) then the response that results from [POST login/oauth2/token](https://github.com/instructure/api-docu-portal/blob/prod/gitbook/services/canvas/file.oauth_endpoints.html#post-login-oauth2-token) would be:

```
  {
    "access_token": null,
    "token_type": "Bearer",
    "user":{"id": 42, "name": "Jimi Hendrix"}
  }
  
```

**Examples using client\_credentials**

When using grant\_type=client\_credentials (ex: [to access LTI Advantage Services](../file.oauth#accessing-lti-advantage-services)):

**Example request**

This request must be signed by an RSA256 private key with a public key that is configured on the developer key as described in [Step 1: Developer Key Setup](../file.oauth#developer-key-setup).

```
  {
    "grant_type": "client_credentials",
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMTktMDYtMjFUMTQ6NTk6MzBaIn0.eyJpc3MiOiJodHRwczovL3d3dy5teS10b29sLmNvbSIsInN1YiI6Ilx1MDAzY2NsaWVudF9pZFx1MDAzZSIsImF1ZCI6Imh0dHA6Ly9cdTAwM2NjYW52YXNfZG9tYWluXHUwMDNlL2xvZ2luL29hdXRoMi90b2tlbiIsImlhdCI6MTU2MTc1MDAzMSwiZXhwIjoxNTYxNzUwNjMxLCJqdGkiOiJkZmZkYmRjZS1hOWYxLTQyN2ItOGZjYS02MDQxODIxOTg3ODMifQ.lUHCwDqx2ukKQ2vwoz_824IVcyq-rNdJKVpGUiJea5-Ybk_VfyKW5v0ky-4XTJrGHkDcj0T9J8qKfYbikqyetK44yXx1YGo-2Pn2GEZ26bZxCnuDUDhbqN8OZf4T8DnZsYP4OyhOseHERsHCzKF-SD2_Pk6ES5-Z8J55_aMyS3w3tl4nJtwsMm6FbMDp_FhSGE4xTwkBZ2KNM4JqkCwHGX_9KcpsPsHRFQjn9ysTeg-Qf7H2QFgFMFjsfQX-iSL_bQoC2npSz7rQ8awKMhCEYdMYZk2vVhQ7XQ8ysAyf3m1vlLbHjASpztcAB0lz_DJysT0Ep-Rh311Qf_vXHexjVA",
    "scope": "https://purl.imsglobal.org/spec/lti-ags/lineitem https://purl.imsglobal.org/spec/lti-ags/result/read"
  }
  
```

Below is an example of the decoded client\_assertion JWT in the above request:

```
  //Header
  {
    "typ": "JWT",
    "alg": "RS256",
    "kid": "2019-06-21T14:59:30Z"
  }
  //Payload
  {
    "iss": "https://www.my-tool.com",
    "sub": "<client_id>",
    "aud": "https://<canvas_domain>/login/oauth2/token",
    "iat": 1561750031,
    "exp": 1561750631,
    "jti": "dffdbdce-a9f1-427b-8fca-604182198783"
  }
  
```

NOTE:

* the value of the sub claim should match the client\_id of the developer key in Canvas.
* the value of the aud claim should contain either the domain of the Canvas account where the desired data resides, or the domain of the LTI 1.3 OIDC Auth endpoint, as described [here](../../external-tools/lti/file.lti_launch_overview#step-2).
* if the public key defined on the developer key is a JWK set (specified by an URL) the kid (key ID) value in the signed JWT header must match one of the public keys returned by the public key URL.

**Example Response**

| Parameter     | Description                                                               |
| ------------- | ------------------------------------------------------------------------- |
| access\_token | The OAuth2 client\_credentials access token.                              |
| token\_type   | The type of token that is returned.                                       |
| expires\_in   | Seconds until the access token expires.                                   |
| scope         | The scope or space delimited list of scopes granted for the access token. |

```
  {
    "access_token" : "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3d3cuZXhhbXBsZS5jb20iLCJpYXQiOiIxNDg1OTA3MjAwIiwiZXhwIjoiMTQ4NTkwNzUwMCIsImltc2dsb2JhbC5vcmcuc2VjdXJpdHkuc2NvcGUiOiJMdGlMaW5rU2V0dGluZ3MgU2NvcmUuaXRlbS5QVVQifQ.UWCuoD05KDYVQHEcciTV88YYtWWMwgb3sTbrjwxGBZA",
    "token_type" : "Bearer",
    "expires_in" : 3600,
    "scope" : "https://purl.imsglobal.org/spec/lti-ags/lineitem https://purl.imsglobal.org/spec/lti-ags/result/read"
  }
  
```

### DELETE login/oauth2/token <a href="#delete-login-oauth2-token" id="delete-login-oauth2-token"></a>

If your application supports logout functionality, you can revoke your own access token. This is useful for security reasons, as well as removing your application from the list of tokens on the user's profile page. Simply make an authenticated request to the following endpoint by including an Authorization header or providing the access\_token as a request parameter.

#### DELETE /login/oauth2/token

**Parameters**

| Parameter        | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| expire\_sessions | Optional | <p>Set this to '1' if you want to end all of the user's Canvas web sessions. Without this argument, the endpoint will leave web sessions intact.</p><p>Additionally, if the user logged in to Canvas via a delegated authentication provider, and the provider supports Single Log Out functionality, the response will contain a forward_url key. If you are still in control of the user's browsing session, it is recommended to then redirect them to this URL, in order to also log them out from where their session originated. Beware that it is unlikely that control will be returned to your application after this redirect.</p> |

**Example responses**

```
  {
    "forward_url": "https://idp.school.edu/opaque_url"
  }
  
```

### GET login/session\_token <a href="#get-login-session-token" id="get-login-session-token"></a>

If your application needs to begin a normal web session in order to access features not supported via API (such as quiz taking), you can use your API access token in order to get a time-limited URL that can be fed to a browser or web view to begin a new web session.

#### GET /login/session\_token

**Parameters**

| Parameter  | Required | Description                                                                                    |
| ---------- | -------- | ---------------------------------------------------------------------------------------------- |
| return\_to | Optional | An optional URL to begin the web session at. Otherwise the user will be sent to the dashboard. |

**Example responses**

```
  {
    "session_url": "https://canvas.instructure.com/opaque_url"
  }
  
```

***

This documentation is generated directly from the Canvas LMS source code, available [on Github](https://github.com/instructure/canvas-lms).
