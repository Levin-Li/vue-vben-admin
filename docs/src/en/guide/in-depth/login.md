# Login

This document explains how to customize the login page of your application.

## Login Page Adjustment

If you want to adjust the title, description, icon, and toolbar of the login page, you can do so by configuring the `props` parameter of the `AuthPageLayout` component.

![login](/guide/login.png)

You just need to configure the `props` parameter of `AuthPageLayout` in `src/router/routes/core.ts` within your application:

```ts {4-8}
 {
    component: AuthPageLayout,
    props: {
      sloganImage: "xxx/xxx.png",
      pageTitle: "开箱即用的大型中后台管理系统",
      pageDescription: "工程化、高性能、跨组件库的前端模版",
      toolbar: true,
      toolbarList: ['color', 'language', 'layout', 'theme'],
    }
    // ...
  },
```

::: tip

If these configurations do not meet your needs, you can implement your own login page. Simply implement your own `AuthPageLayout`.

:::

## Password Login Challenge and MFA

The base module does not look up an account's MFA state when the account field loses focus. After the user clicks Login, the client calls `startPasswordLoginApi({ account, password })`. Only after the server has audited the password, domain, and tenant does it return a one-time `challengeId` and `verifyCodeType`.

```ts
const challenge = await startPasswordLoginApi({ account, password });

await completePasswordLoginApi({
  account,
  loginVerifyChallengeId: challenge.challengeId,
  verifyCode,
  verifyCodeType: challenge.verifyCodeType,
});
```

Keep the following boundaries:

- `Mfa` opens a Google Authenticator dialog for the current six-digit code. Do not fall back to a captcha or add another “Next” action.
- `Captcha` completes in a separate security dialog. When a code is filled automatically, show a red five-second countdown and submit automatically. Cancel the countdown when the user types, refreshes the image, or closes the dialog.
- A challenge with no verification type can be completed immediately; create the session and redirect on success.
- SMS and email code login keep their existing flow and do not create a password-login challenge.
- Clear the `challengeId`, code, and countdown after cancellation, failure, or account changes; never reuse a challenge.

Do not add an account-blur endpoint that reports supported verification methods: it broadens account-enumeration risk. See the root project document `docs/15-密码登录挑战与MFA安全开发指南.md` for the backend contract and revalidation rules.

## Login Form Adjustment

If you want to adjust the content of the login form, you can configure the `AuthenticationLogin` component parameters in `src/views/_core/authentication/login.vue` within your application:

```vue
<AuthenticationLogin
  :loading="authStore.loginLoading"
  @submit="authStore.authLogin"
/>
```

::: details AuthenticationLogin Component Props

```ts
{
  /**
   * @en Verification code login path
   */
  codeLoginPath?: string;
  /**
   * @en Forget password path
   */
  forgetPasswordPath?: string;

  /**
   * @en Whether it is in loading state
   */
  loading?: boolean;

  /**
   * @en QR code login path
   */
  qrCodeLoginPath?: string;

  /**
   * @en Registration path
   */
  registerPath?: string;

  /**
   * @en Whether to show verification code login
   */
  showCodeLogin?: boolean;
  /**
   * @en Whether to show forget password
   */
  showForgetPassword?: boolean;

  /**
   * @en Whether to show QR code login
   */
  showQrcodeLogin?: boolean;

  /**
   * @en Whether to show registration button
   */
  showRegister?: boolean;

  /**
   * @en Whether to show remember account
   */
  showRememberMe?: boolean;

  /**
   * @en Whether to show third-party login
   */
  showThirdPartyLogin?: boolean;

  /**
   * @en Login box subtitle
   */
  subTitle?: string;

  /**
   * @en Login box title
   */
  title?: string;
}
```

:::

::: tip

If these configurations do not meet your needs, you can implement your own login form and related login logic.

:::
