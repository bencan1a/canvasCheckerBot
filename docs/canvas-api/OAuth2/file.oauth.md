# OAuth2 Overview

{% hint style="warning" %}
**Welcome to Our New API Docs!** This is the new home for all things API (previously at [Canvas LMS REST API Documentation](https://api.instructure.com)).
{% endhint %}

## OAuth2

{% hint style="warning" %}
Developer keys issued after Oct 2015 generate tokens with a 1 hour expiration. Applications must use [refresh tokens](#using-refresh-tokens) to generate new access tokens.
{% endhint %}

[OAuth2](http://oauth.net/2) is a protocol designed to let third-party applications authenticate to perform actions as a user, without getting the user's password. Canvas uses OAuth2 (specifically [RFC-6749](http://tools.ietf.org/html/rfc6749)) for authentication and authorization of the Canvas API. Additionally, Canvas uses OAuth2 for [LTI Advantage](https://www.imsglobal.org/activity/learning-tools-interoperability) service authentication (as described in the [IMS Security Framework](https://www.imsglobal.org/spec/security/v1p0/)).

#### [Accessing the Canvas API](#accessing-canvas-api)

* [Storing Tokens](#storing-access-tokens)
* [Manual Token Generation](#manual-token-generation)
* [Oauth2 Flow](#oauth2-flow)
  * [Getting OAuth2 Client ID/Secret](#oauth2-flow-0)
  * [Step 1: Redirect users to request Canvas access](#oauth2-flow-1)
  * [Step 2: Redirect back to the request\_uri, or out-of-band redirect](#oauth2-flow-2)
    * [Note for native apps](#oauth2-flow-2.1)
  * [Step 3: Exchange the code for the final access token](#oauth2-flow-3)
* [Using an Access Token to authenticate requests](#using-access-tokens)
* [Using a Refresh Token to get a new Access Token](#using-refresh-tokens)
* [Logging Out](../file.oauth_endpoints#delete-login-oauth2-token)
* [Endpoints](file.oauth_endpoints)
  * [GET login/oauth2/auth](../file.oauth_endpoints#get-login-oauth2-auth)
  * [POST login/oauth2/token](../file.oauth_endpoints#post-login-oauth2-token)
  * [DELETE login/oauth2/token](../file.oauth_endpoints#delete-login-oauth2-token)
  * [GET login/session\_token](../file.oauth_endpoints#get-login-session-token)

#### [Accessing LTI Advantage Services](#accessing-lti-advantage-services-link)

* [Step 1: Developer Key Setup](#developer-key-setup)
* [Step 2: Request an Access Token](#request-access-token)
* [Step 3: Use the access token to access LTI services](#use-access-token)

## [Accessing the Canvas API](#accessing-canvas-api) <a href="#accessing-canvas-api" id="accessing-canvas-api"></a>

[Back to Top](#top)

### [Storing Tokens](#storing-access-tokens) <a href="#storing-access-tokens" id="storing-access-tokens"></a>

[Back to Top](#top)

When appropriate, applications should store the token locally, rather than requesting a new token for the same user each time the user uses the application. If the token is deleted or expires, the application will get a 401 Unauthorized error from the API, in which case the application should perform the OAuth flow again to receive a new token. You can differentiate this 401 Unauthorized from other cases where the user simply does not have permission to access the resource by checking that the WWW-Authenticate header is set.

Storing a token is in many ways equivalent to storing the user's password, so tokens should be stored and used in a secure manner, including but not limited to:

* Don't embed tokens in web pages.
* Don't pass tokens or session IDs around in URLs.
* Properly secure the database or other data store containing the tokens.
* For web applications, practice proper techniques to avoid session attacks such as cross-site scripting, request forgery, replay attacks, etc.
* For native applications, take advantage of user keychain stores and other operating system functionality for securely storing passwords.

### [Manual Token Generation](#manual-token-generation) <a href="#manual-token-generation" id="manual-token-generation"></a>

[Back to Top](#top)

For testing your application before you've implemented OAuth, the simplest option is to generate an access token on your user's profile page. Note that asking any other user to manually generate a token and enter it into your application is a violation of [Canvas' API Policy](https://www.instructure.com/policies/api-policy). Applications in use by multiple users MUST use OAuth to obtain tokens.

To manually generate a token for testing:

1. Click the "profile" link in the top right menu bar, or navigate to `/profile`
2. Under the "Approved Integrations" section, click the button to generate a new access token.
3. Once the token is generated, you cannot view it again, and you'll have to generate a new token if you forget it. Remember that access tokens are password equivalent, so keep it secret.

### [Oauth2 Flow](#oauth2-flow) <a href="#oauth2-flow" id="oauth2-flow"></a>

[Back to Top](#top)

Your application can rely on canvas for a user's identity. During step 1 of the web application flow below, specify the optional scope parameter as scope=/auth/userinfo. When the user is asked to grant your application access in step 2 of the web application flow, they will also be given an option to remember their authorization. If they grant access and remember the authorization, Canvas will skip step 2 of the request flow for future requests.

Canvas will not give a token back as part of a userinfo request. It will only provide the current user's name and id.

#### [Getting OAuth2 Client ID/Secret](#oauth2-flow-0) <a href="#oauth2-flow-0" id="oauth2-flow-0"></a>

If your application will be used by others, you will need to implement the full OAuth2 token request workflow, so that you can request an access token for each user of your application.

Performing the OAuth2 token request flow requires an application client ID and client secret. To obtain these application credentials, you will need to register your application. The client secret should never be shared.

For Canvas Cloud (hosted by Instructure), developer keys are [issued by the admin of the institution](https://community.canvaslms.com/t5/Admin-Guide/How-do-I-manage-developer-keys-for-an-account/ta-p/249).

NOTE for LTI providers: Since developer keys are scoped to the institution they are issued from, tool providers that serve multiple institutions should store and look up the correct developer key based on the launch parameters (eg. custom\_canvas\_api\_domain) sent during the LTI launch.

For [open source Canvas users](https://github.com/instructure/canvas-lms/wiki), you can [generate a client ID](https://community.canvaslms.com/t5/Admin-Guide/How-do-I-manage-developer-keys-for-an-account/ta-p/249) and secret in the Site Admin account of your Canvas install.

#### [Step 1: Redirect users to request Canvas access](#oauth2-flow-1) <a href="#oauth2-flow-1" id="oauth2-flow-1"></a>

[Back to Top](#top)

A basic request looks like:

#### GET https://\<canvas-install-url>/login/oauth2/auth?client\_id=XXX\&response\_type=code\&state=YYY\&redirect\_uri=https://example.com/oauth2response

See [GET login/oauth2/auth](../file.oauth_endpoints#get-login-oauth2-auth) for details.

#### [Step 2: Redirect back to the request\_uri, or out-of-band redirect](#oauth2-flow-2) <a href="#oauth2-flow-2" id="oauth2-flow-2"></a>

[Back to Top](#top)

If the user accepts your request, Canvas redirects back to your request\_uri with a specific query string, containing the OAuth2 response:

#### http://www.example.com/oauth2response?code=XXX\&state=YYY

The app can then extract the code, and use it along with the client\_id and client\_secret to obtain the final access\_key.

If your application passed a state parameter in step 1, it will be returned here in step 2 so that your app can tie the request and response together, whether the response was successful or an error occurred.

If the user doesn't accept the request for access, or if another error occurs, Canvas redirects back to your request\_uri with an `error` parameter, rather than a `code` parameter, in the query string.

#### http://www.example.com/oauth2response?error=access\_denied\&error\_description=a\_description\&state=YYY

A list of possible error codes is found in the [RFC-7649 spec](https://datatracker.ietf.org/doc/html/rfc6749#section-4.2.2.1).

#### [Note for native apps](#oauth2-flow-2.1) <a href="#oauth2-flow-2.1" id="oauth2-flow-2.1"></a>

[Back to Top](#top)

Canvas redirects to a page on canvas with a specific query string, containing parameters from the OAuth2 response:

```
/login/oauth2/auth?code=<code>
```

#### /login/oauth2/auth?code=\<code>

At this point the app should notice that the URL of the webview has changed to contain `code=<code>` somewhere in the query string. The app can then extract the code, and use it along with the client\_id and client\_secret to obtain the final access\_key.

#### [Step 3: Exchange the code for the final access token](#oauth2-flow-3) <a href="#oauth2-flow-3" id="oauth2-flow-3"></a>

[Back to Top](#top)

To get a new access token and refresh token, send a [POST request to login/oauth2/token](../file.oauth_endpoints#post-login-oauth2-token) with the following parameters:

**Parameters**

| Parameter       | Value                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| grant\_type     | authorization\_code                                                                                                                                                                         |
| client\_id      | Your client\_id                                                                                                                                                                             |
| client\_secret  | Your client\_secret                                                                                                                                                                         |
| redirect\_uri   | If a redirect\_uri was passed to the initial request in step 1, the same redirect\_uri must be given here.                                                                                  |
| code            | code from canvas                                                                                                                                                                            |
| replace\_tokens | (optional) If this option is set to \`1\`, existing access tokens issued for this developer key/secret will be destroyed and replaced with the new token that is returned from this request |

Note that the once the code issued in step 2 is used in a POST request to this endpoint, it is invalidated and further requests for tokens with the same code will fail.

### [Using an Access Token to authenticate requests](#using-access-tokens) <a href="#using-access-tokens" id="using-access-tokens"></a>

[Back to Top](#top)

Once you have an OAuth access token, you can use it to make API requests. If possible, using the HTTP Authorization header is recommended.

OAuth2 Token sent in header:

```bash
curl -H "Authorization: Bearer <ACCESS-TOKEN>" "https://canvas.instructure.com/api/v1/courses"
```

Sending the access token in the query string or POST parameters is also supported, but discouraged as it increases the chances of the token being logged or leaked in transit.

OAuth2 Token sent in query string:

```bash
curl "https://canvas.instructure.com/api/v1/courses?access_token=<ACCESS-TOKEN>"
```

### [Using a Refresh Token to get a new Access Token](#using-refresh-tokens) <a href="#using-refresh-tokens" id="using-refresh-tokens"></a>

[Back to Top](#top)

Access tokens have a 1 hour lifespan. When the refresh flow is taken, Canvas will update the access token to a new value, reset the expiration timer, and return the new access token as part of the response. When refreshing tokens the user will not be asked to authorize the application again.

To refresh the access token, send a [POST request to login/oauth2/token](../file.oauth_endpoints#post-login-oauth2-token) with the following parameters:

**Parameters**

| Parameter      | Value                                             |
| -------------- | ------------------------------------------------- |
| grant\_type    | refresh\_token                                    |
| client\_id     | Your client\_id                                   |
| client\_secret | Your client\_secret                               |
| refresh\_token | refresh\_token from initial access\_token request |

The response to this request will not contain a new refresh token; the same refresh token is to be reused.

### [Logging Out](../file.oauth_endpoints#delete-login-oauth2-token)

[Back to Top](#top)

To logout, simply send a [DELETE request to login/oauth2/token](../file.oauth_endpoints#delete-login-oauth2-token)

## [Accessing LTI Advantage Services](#accessing-lti-advantage-services) <a href="#accessing-lti-advantage-services-link" id="accessing-lti-advantage-services-link"></a>

[Back to Top](#top)

LTI Advantage services, such as [Names and Role Provisioning Services](https://www.imsglobal.org/spec/lti-nrps/v2p0) and [Assignment and Grade Services](https://www.imsglobal.org/spec/lti-ags/v2p0/), require use of a client credentials grant flow for request authentication. This workflow is best summarized on the IMS Security Framework (specifically [Section 4](https://www.imsglobal.org/spec/security/v1p0/#using-oauth-2-0-client-credentials-grant)).

Our goal here is to highlight some nuances that might help you access these services in Canvas, rather than describing the specification in detail.

### [Step 1: Developer Key Setup](#developer-key-setup) <a href="#developer-key-setup" id="developer-key-setup"></a>

[Back to Top](#top)

Before the client\_credentials grant flow can be achieved, an [LTI developer key must be created](https://community.canvaslms.com/t5/Admin-Guide/How-do-I-configure-an-LTI-key-for-an-account/ta-p/140). During developer key configuration, a public JWK can either be configured statically or can be dynamically rotated by providing JWKs by a URL that Canvas can reach. Tools may also use a previously issued client\_credentials token to [retroactively rotate the public JWK via an API request](../resources/public_jwk). The JWK must include an alg and use.

**Example JWK**

```
   "public_jwk": {
      "kty":"RSA",
      "alg":"RS256",
      "e":"AQAB",
      "kid":"8f796179-7ac4-48a3-a202-fc4f3d814fcd",
      "n":"nZA7QWcIwj-3N_RZ1qJjX6CdibU87y2l02yMay4KunambalP9g0fU9yILwLX9WYJINcXZDUf6QeZ-SSbblET-h8Q4OvfSQ7iuu0WqcvBGy8M0qoZ7I-NiChw8dyybMJHgpiP_AyxpCQnp3bQ6829kb3fopbb4cAkOilwVRBYPhRLboXma0cwcllJHPLvMp1oGa7Ad8osmmJhXhN9qdFFASg_OCQdPnYVzp8gOFeOGwlXfSFEgt5vgeU25E-ycUOREcnP7BnMUk7wpwYqlE537LWGOV5z_1Dqcqc9LmN-z4HmNV7b23QZW4_mzKIOY4IqjmnUGgLU9ycFj5YGDCts7Q",
      "use":"sig"
   }
  
```

### [Step 2: Request an access token](#request-access-token) <a href="#request-access-token" id="request-access-token"></a>

[Back to Top](#top)

Once the developer key is configured and turned on, your tool can [request an LTI access token using the client\_credentials grant](../file.oauth_endpoints#post-login-oauth2-token). This request must be signed by an RSA256 private key with a public key that is configured on the developer key as described in [Step 1: Developer Key Setup](#developer-key-setup).

### [Step 3: Use the access token to access LTI services](#use-access-token) <a href="#use-access-token" id="use-access-token"></a>

[Back to Top](#top)

Once you have an access token, you can use it to make LTI service requests. The access token must be included as a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer <ACCESS-TOKEN>" "https://<canvas_domain>/api/lti/courses/:course_id/names_and_roles"
```

Access tokens only work in the context of where a tool has been deployed. Tools can only access line items that are associated with their tool.

The following endpoints are currently supported:

#### Names and Role Provisioning Services

* [Names and Role API](../resources/names_and_role)

#### Assignment and Grade Services

* [Line Items](../resources/line_items)
* [Score](../resources/score)
* [Result](../resources/result)

***

This documentation is generated directly from the Canvas LMS source code, available [on Github](https://github.com/instructure/canvas-lms).
