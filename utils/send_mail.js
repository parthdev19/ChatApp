var nodemailer = require("nodemailer");
const fs = require("fs");

const sendOtpCode = async (data) => {
  try {
    console.log("Email data ==>", data);
    var transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      auth: {
        user: process.env.MAIL_FROM_ADDRESS,
        pass: process.env.MAIL_PASSWORD,
      }
    });
    var sendOtp = {
      from: process.env.MAIL_FROM_ADDRESS,
      to: data.emailAddress,
      subject: "Your OTP for reset password",
                html: `<!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>OTP Email Template</title>
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
              <style>
                  body {
                      margin: 0;
                      font-family: 'Poppins', sans-serif;
                      background-color: #f4f4f4;
                      padding: 20px;
                  }
                  .container {
                      background: #000;
                      border-radius: 20px;
                      text-align: center;
                      box-shadow: 0 6px 18px 0 rgba(0, 0, 0, .06);
                      max-width: 415px;
                      margin: 0 auto;
                      padding: 40px;
                  }
                  .logo-area {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                  }
                  .logo-img {
                      max-width: 100px;
                  }
                  .chatbox-name {
                      color: white;
                      font-size: 30px; /* Adjusted for responsiveness */
                      font-weight: 600;
                      margin-top: 10px; /* Adjusted for responsiveness */
                  }
                  .content {
                      text-align: left;
                      font-family: 'Poppins', sans-serif;
                  }
                  .greeting {
                      color: #D7D7D7;
                      font-weight: 500;
                      margin-top: 20px;
                      font-size: 16px; /* Adjusted for responsiveness */
                  }
                  .greeting span {
                      font-weight: 600;
                  }
                  .text {
                      font-size: 15px; /* Adjusted for responsiveness */
                      line-height: 22px;
                      color: #D7D7D7;
                  }
                  .otp-code {
                      margin: 20px 0;
                      font-size: 18px; /* Adjusted for responsiveness */
                      font-weight: 600;
                      color: #ffffff82;
                      text-transform: uppercase;
                      text-align: center;
                      border-radius: 5px;
                      padding: 15px;
                  }
                  .otp-value {
                      line-height: 40px; /* Adjusted for responsiveness */
                      font-weight: 700;
                      font-size: 36px; /* Adjusted for responsiveness */
                      color: #1781F1;
                  }
                  .support-link {
                      text-decoration: none;
                      font-weight: 600;
                      color: #1781F1;
                  }
                  .team-signature {
                      color: #D7D7D7;
                      font-weight: 500;
                      font-size: 16px; /* Adjusted for responsiveness */
                      line-height: 25px;
                  }
                  .team-signature span {
                      font-weight: 600;
                      color: #1781F1;
                  }
                  .chatbox-name {
                      margin-top: 30px;
                  }

                  @media screen and (max-width: 480px) {
                      .container {
                          padding: 20px;
                      }
                      .logo-img {
                          max-width: 80px;
                      }
                      .chatbox-name {
                          font-size: 24px;
                      }
                      .greeting, .text, .otp-code, .team-signature {
                          font-size: 14px;
                      }
                      .otp-value {
                          font-size: 28px;
                          line-height: 30px;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="logo-area">
                      <img src="https://gcdnb.pbrd.co/images/9ekZ6JlUxcVl.png?o=1" alt="Logo" class="logo-img">
                      <span class="chatbox-name">ChatBox</span>
                  </div>
                  <div class="content">
                      <h1 class="greeting">
                          Dear <span class="name">${data.name}</span>,
                      </h1>
                      <p class="text">
                          It seems you've requested to reset your password for ChatBox. We're here to help you regain access to your account.
                      </p>
                      <p class="text">
                          To complete the password reset process, please use the verification code below:
                      </p>
                      <h2 class="otp-code">
                          Verification Code<br>
                          <span class="otp-value">${data.otp}</span>
                      </h2>
                      <p class="text">
                          Please enter this code on the password reset page within the next 10 minutes to proceed with resetting your password. If you didn't initiate this request, please ignore this email or reach out to our support team immediately at
                          <a href="#" class="support-link">${process.env.MAIL_FROM_ADDRESS}</a>.
                      </p>
                      <p class="text">
                          Remember to create a strong, unique password that you haven't used before to secure your account.
                      </p>
                      <p class="text">
                          Thank you for using ChatBox. If you have any questions or need further assistance, don't hesitate to contact us.
                      </p>
                      <h1 class="team-signature">
                          Best regards, <br>
                          <span>ChatBox Team</span>
                      </h1>
                  </div>
              </div>
          </body>
          </html>
  `,
    };
    
    return await transporter.sendMail(sendOtp);
  } catch (error) {
    console.log("Error in sendOtpCode", error);
  }
};

const sendleandingPagecontact = async (data) => {
  console.log("data is email", data);
  var transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: false, // 🔴 Make sure this is false for port 587
    auth: {
      user: process.env.MAIL_FROM_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false, // ✅ Add this to fix SSL/TLS issues
    },
  });

  
  var sendOtp = {
    from: process.env.MAIL_FROM_ADDRESS,
    to: data.emailAddress,
    subject: "Chat box",
    html: `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>OTP Email Template</title>
    </head>
    <body style="margin: 50px; background-color: #000000;">
    
      <div style="background: #000; border-radius: 3px; text-align: center; box-shadow: 0 6px 18px 0 rgba(0,0,0,.06);background-position: center; background-size: cover; max-width: 570px; margin: 0 auto; padding: 50px;">
    
        <div style="text-align:center;"><img src='${process.env.APP_LOGO}' style="width: 250px;"></div>
        <div style="text-align: start; font-family: 'Urbanist', sans-serif;">
          <h1 style="color: #D7D7D7; font-weight: 500; margin: 0; font-size: 17px;">Dear Admin,
          </h1>
          <p style="font-size: 16px; line-height: 20px; color: #D7D7D7;">I hope this email finds you well.</p>
    
          <p style="font-size: 16px; line-height: 20px; color: #D7D7D7;">I wanted to reach out regarding user's recent inquiry. They have provided the following details:</p>
    
          <ul style="font-size: 16px; line-height: 20px; color: #D7D7D7;">
            <li style="padding-bottom: 10px;">Name: <span>${data.name}</span></li>
            <li style="padding-bottom: 10px;">Email: <span>${data.email}</span></li>
            <li>Message: <span>${data.message}</span></li>
          </ul>
    
          <p style="font-size: 16px; line-height: 20px; color: #D7D7D7;">Could you please assist them with their inquiry at your earliest convenience?</p>
          <p style="font-size: 16px; line-height: 20px; color: #D7D7D7;">Thank you for your attention to this matter.</p>
          <h1 style="color: #D7D7D7; font-weight: 500; margin: 0; font-size: 17px; line-height: 25px;">Best regards, <br>
            <span style="font-weight: 600">Chat box</span>
          </h1>
        </div>
    
      </div>
    
    </body>
    </html>`,
  };
  return await transporter.sendMail(sendOtp);
};

module.exports = { sendOtpCode, sendleandingPagecontact };
