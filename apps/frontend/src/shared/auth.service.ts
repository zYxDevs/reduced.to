import { Cookie } from '@builder.io/qwik-city';
import jwt_decode from 'jwt-decode';
import { UserCtx } from '../routes/layout';

export const ACCESS_COOKIE_NAME = 'accessToken';
export const REFRESH_COOKIE_NAME = 'refreshToken';

export const ACCESS_COOKIE_EXPIRES = 5 * 60 * 1000; //5 min
export const REFRESH_COOKIE_EXPIRES = 7 * 24 * 60 * 60 * 1000; //7 days

export const validateAccessToken = async (cookies: Cookie): Promise<boolean> => {
  const accessToken = cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookies.get(REFRESH_COOKIE_NAME)?.value;

  // Exit early if no access token and no refresh token are available
  if (!accessToken && !refreshToken) {
    return false;
  }

  // Decode the access token if it exists
  const decodedToken = accessToken ? jwt_decode<UserCtx & { exp: number }>(accessToken) : null;

  // If the access token is still valid, return true
  if (decodedToken) {
    return true;
  }

  // If the access token is expired but a refresh token exists, try to refresh
  if (refreshToken) {
    try {
      const refreshedTokens = await refreshTokens(refreshToken);
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshedTokens;

      if (newAccessToken) {
        setTokensAsCookies(newAccessToken, newRefreshToken, cookies);
        return validateAccessToken(cookies); // Recursively validate the new access token
      }
    } catch (error) {
      console.error('Failed to refresh tokens', error);
    }
  }

  // If no valid access token or refresh token, return false
  return false;
};

export const setTokensAsCookies = (accessToken: string, refreshToken: string, cookie: Cookie) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = isProduction ? `.${process.env.DOMAIN}` : 'localhost';
  cookie.set(ACCESS_COOKIE_NAME, accessToken, {
    path: '/',
    sameSite: 'lax',
    domain,
    secure: isProduction,
    httpOnly: true,
    expires: new Date(new Date().getTime() + ACCESS_COOKIE_EXPIRES),
  });
  cookie.set(REFRESH_COOKIE_NAME, refreshToken, {
    path: '/',
    sameSite: 'lax',
    domain,
    secure: isProduction,
    httpOnly: true,
    expires: new Date(new Date().getTime() + REFRESH_COOKIE_EXPIRES),
  });
};

export const serverSideFetch = async (url: string, cookies: Cookie, options = {}) => {
  const accessToken = cookies.get(ACCESS_COOKIE_NAME)?.value;

  return authorizedFetch(url, {
    headers: {
      contentType: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    ...options,
  });
};

export const authorizedFetch = async (url: string, options = {}) => {
  const response = await fetch(url, { credentials: 'include', ...options });

  if (response.status === 401) {
    // Attempt to refresh the token
    console.debug('Attempt to refresh the token');
    const refreshResponse = await fetch(`${process.env.API_DOMAIN}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshResponse.ok) {
      // Token refreshed successfully, retry the original request
      return fetch(url, { credentials: 'include', ...options });
    } else {
      // Handle failure to refresh the token
      throw new Error('Session expired. Please log in again.');
    }
  }

  return response;
};

export const refreshTokens = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const res = await fetch(`${process.env.API_DOMAIN}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`,
      },
    });

    if (res.ok) {
      const { accessToken, refreshToken } = await res.json();

      return {
        accessToken,
        refreshToken,
      };
    }
  } catch (err) {
    console.error('Failed to refresh access token', err);
  }

  return {
    accessToken: '',
    refreshToken: '',
  };
};

export const PROFILE_PICTURE_PREFIX = 'profile-pictures';
