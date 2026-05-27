# Dynamic Verify Code Flow

## Purpose

Dynamic verification is a shared second-factor flow for protected API requests. It is handled by the common frontend request client, so business pages normally do not need custom code.

## Backend Protocol

When a protected API request matches a URL ACL verification rule, the backend first tells the frontend that verification is required.

First protected API response:

```http
-DynamicVerifyCode-: Apply
-DynamicVerifyCode-Type: Sms | Email | Mfa | Captcha
-DynamicVerifyCode-Prompt: <url-encoded prompt>
```

The frontend shows one modal dialog and keeps the original request pending.

For `Sms` and `Email`, the user clicks the inline get-code button in the modal. The frontend then repeats the same protected request with the apply header:

```http
-DynamicVerifyCode-: Apply
-DynamicVerifyCode-RequestHash: <original request body hash>
```

For `Captcha` and `Mfa`, the frontend does not show a get-code button. It sends the apply request automatically after the modal opens. For `Captcha`, clicking the captcha image sends another apply request and refreshes the image.

Apply response:

```http
-DynamicVerifyCode-ParamName: DVC-<login-token>
-DynamicVerifyCode-VerifyId: <verification id>
-DynamicVerifyCode-Type: Sms | Email | Mfa | Captcha
-DynamicVerifyCode-Prompt: <url-encoded server prompt>
-DynamicVerifyCode--InteractionData: <url-encoded interaction data>
```

`Sms` and `Email` usually return a prompt such as the destination phone number or email. `Captcha` returns image data, typically base64. `Mfa` may return a link, QR payload, or other interaction data.

Final replay request:

```http
DVC-<login-token>: <user-input-code>
-DynamicVerifyCode-VerifyId: <verification id>
-DynamicVerifyCode-RequestHash: <original request body hash>
```

The final replay preserves the original API method, URL, body, query, and custom headers.

The backend calculates the verification ID from the original request identity: user, tenant, app ID, verification type, HTTP method, URL path, and request body hash. The verification code service controls code expiry and one-time verification.

## Frontend Flow

1. The user triggers a normal business API request.
2. The shared response interceptor detects `-DynamicVerifyCode-: Apply`.
3. The frontend opens one centered modal titled `该操作需要xx验证`.
4. The modal shows the verification type clearly and provides a code input.
5. `Sms` and `Email` show a get-code button to the right of the input.
6. `Captcha` shows the captcha image to the right of the input after it is loaded. Clicking the image refreshes the captcha.
7. `Mfa` does not show a get-code button.
8. The server prompt returned after apply is displayed under the input line in small red text.
9. The user clicks `确定`; the frontend replays the original request with the dynamic parameter returned by the backend.
10. If backend verification succeeds, the original API call resolves normally.

## Modal Behavior

The verification dialog uses a 400px width with enough vertical space for the input, action area, server prompt, and captcha image. It is centered and modal. It disables mask-click close, Escape close, and the close icon.

The only user exits are `取消` and `确定`. Canceling rejects the original request with a canceled dynamic-verification error.

## Captcha Rendering

For image captcha, the frontend renders `InteractionData` as an image when it receives:

- `data:image/...` URLs
- JPEG base64
- PNG base64
- GIF base64
- SVG base64

The image is placed on the right side of the input, matching the login captcha layout. Clicking the image sends the apply request again and refreshes the captcha.

## Scope

This automatic flow applies only to API calls that use the shared `requestClient` or `baseRequestClient`. Requests made with raw `fetch` or a separate client will not participate in dynamic verification unless they add the same interceptor.
