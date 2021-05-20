const verifyEmail = {
  ja: {
    title: 'Peer8へようこそ！',
    message: token => {
      return `
      <p>Peer8へのユーザー登録のご案内です。</p>

      <p>以下のURLをクリックすると、本登録が完了します。</p>
      <p><a target="_blank" href="https://api.peer8.com/users/activate/${token}">https://api.peer8.com/users/activate/${token}</a></p>

      <p>※このURLをクリックしていただかないと、本登録が完了しません。必ずこのURLをクリックしてお進みください。</p>
      <p>※このメールはPeer8へユーザー登録して頂いた方へお送りしています。</p>
      <p>このメールにお心当たりのない場合は、お手数ですが破棄願います。</p>`
    },
  },
  en: {
    title: 'Welcome to Peer8!',
    message: token => {
      return `
      <p>Email verification</p>

      <p>If you registered recently on https://peer8.com, please click the link below (or copy and paste it in the browser) to verify your email address.</p>
      <p><a target="_blank" href="https://api.peer8.com/users/activate/${token}">https://api.peer8.com/users/activate/${token}</a></p>

      <p>If you didn't register, then please ignore this email. Somebody might have registered with the wrong email address.</p>
      <p>This email was automatically generated, please do not reply.</p>
      `
    },
  },
}

const resetPassword = {
  ja: {
    title: 'Peer8へのパスワード・リセットのご案内です。',
    message: (user, token) => {
      let intro = ''
      if (user.name) intro = `${user.name}様、`
      return `
      <p>${intro}</p>
      <p>あなたは、メールアドレス (${user.email}) で登録されているPeer8アカウントのパスワードのリセットをリクエストしました。このリンクをクリックして、パスワードをリセットして下さい。</p>
      <p><a target="_blank" href="https://api.peer8.com/auth/resetPassword?t=${token}">https://api.peer8.com/auth/resetPassword?t=${token}</a></p>

      <p>※このメールはPeer8へユーザー登録して頂いた方へお送りしています。</p>
      <p>このメールにお心当たりのない場合は、お手数ですが破棄願います。</p>`
    },
  },
  en: {
    title: 'Peer8 password reset.',
    message: (user, token) => {
      let intro = ''
      if (user.name) intro = `Dear ${user.name},`
      return `
      <p>${intro}</p>
      <p>If you requested a password reset for ${user.email}, please click on the link below (or copy and past it in the browser) to change your password.</p>
      <p><a target="_blank" href="https://api.peer8.com/auth/resetPassword?t=${token}">https://api.peer8.com/auth/resetPassword?t=${token}</a></p>

      </p>This email was automatically generated, please do not reply.<p>`
    },
  },
}

function textVerifyEmail(locale) {
  return verifyEmail[locale] || verifyEmail.en
}

function textResetPassword(locale) {
  return resetPassword[locale] || resetPassword.en
}

module.exports = {
  textResetPassword,
  textVerifyEmail,
}
