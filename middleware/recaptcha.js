import axios from 'axios';

// Verify reCAPTCHA v2 token
export const verifyRecaptcha = async (token, remoteIp = null) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY_V2;
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY_V2 not configured');
      return { success: false, message: 'reCAPTCHA not configured' };
    }

    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    
    const params = new URLSearchParams({
      secret: secretKey,
      response: token
    });

    // Add remoteip if provided (optional but recommended)
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await axios.post(verificationUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: response.data.success,
      message: response.data.success ? 'reCAPTCHA verified successfully' : 'reCAPTCHA verification failed',
      errorCodes: response.data['error-codes'] || []
    };

  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { 
      success: false, 
      message: 'Failed to verify reCAPTCHA',
      error: error.message 
    };
  }
};
