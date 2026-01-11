import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// OAuth session storage (in-memory for now, use Redis in production)
interface AuthorizationSession {
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  clientId: string;
  scope: string;
  state: string;
  resource: string;
  createdAt: number;
}

interface AccessToken {
  token: string;
  clientId: string;
  scope: string;
  resource: string;
  expiresAt: number;
  createdAt: number;
}

const authorizationCodes = new Map<string, AuthorizationSession>();
const accessTokens = new Map<string, AccessToken>();

// Clean up expired codes and tokens periodically
setInterval(() => {
  const now = Date.now();

  // Clean up codes older than 10 minutes
  for (const [code, session] of authorizationCodes.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      authorizationCodes.delete(code);
    }
  }

  // Clean up expired tokens
  for (const [token, data] of accessTokens.entries()) {
    if (now > data.expiresAt) {
      accessTokens.delete(token);
    }
  }
}, 60 * 1000); // Run every minute

/**
 * Generate a random base64url-encoded string
 */
function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length)
    .toString('base64url')
    .substring(0, length);
}

/**
 * Verify PKCE code challenge
 */
function verifyCodeChallenge(verifier: string, challenge: string, method: string): boolean {
  if (method === 'S256') {
    const computedChallenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
    return computedChallenge === challenge;
  } else if (method === 'plain') {
    return verifier === challenge;
  }
  return false;
}

/**
 * OAuth 2.1 Authorization endpoint
 * Handles the initial authorization request from Claude.ai
 */
export function handleAuthorize(baseUrl: string, authToken: string) {
  return (req: Request, res: Response) => {
    try {
      logger.info('OAuth /authorize request:', {
        query: req.query,
        headers: req.headers
      });

      const {
        client_id,
        redirect_uri,
        response_type,
        code_challenge,
        code_challenge_method,
        state,
        scope,
        resource
      } = req.query as Record<string, string>;

      // Validate required parameters
      if (!client_id || !redirect_uri || !response_type || !code_challenge || !code_challenge_method) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        });
        return;
      }

      // Only support authorization code flow
      if (response_type !== 'code') {
        res.status(400).json({
          error: 'unsupported_response_type',
          error_description: 'Only authorization_code flow is supported'
        });
        return;
      }

      // Only support S256 PKCE
      if (code_challenge_method !== 'S256') {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Only S256 code_challenge_method is supported'
        });
        return;
      }

      // Validate redirect_uri (Claude's callback)
      if (!redirect_uri.startsWith('https://claude.ai/') &&
          !redirect_uri.startsWith('https://claude.com/')) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri'
        });
        return;
      }

      // Generate authorization code
      const authCode = generateRandomString(32);

      // Store authorization session
      authorizationCodes.set(authCode, {
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        redirectUri: redirect_uri,
        clientId: client_id,
        scope: scope || '',
        state: state || '',
        resource: resource || baseUrl,
        createdAt: Date.now()
      });

      logger.info('Generated authorization code:', {
        code: authCode.substring(0, 10) + '...',
        clientId: client_id
      });

      // Build redirect URL with authorization code
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', authCode);
      if (state) {
        redirectUrl.searchParams.set('state', state);
      }

      logger.info('Redirecting to:', { url: redirectUrl.toString() });

      // Redirect back to Claude with the authorization code
      res.redirect(redirectUrl.toString());

    } catch (error) {
      logger.error('Error in /authorize endpoint:', {}, error as Error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  };
}

/**
 * OAuth 2.1 Token endpoint
 * Exchanges authorization code for access token
 */
export function handleToken(authToken: string) {
  return async (req: Request, res: Response) => {
    try {
      logger.info('OAuth /token request:', {
        body: req.body,
        contentType: req.headers['content-type']
      });

      const {
        grant_type,
        code,
        code_verifier,
        client_id,
        redirect_uri,
        resource
      } = req.body;

      // Validate required parameters
      if (!grant_type || !code || !code_verifier || !client_id) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        });
        return;
      }

      // Only support authorization code grant
      if (grant_type !== 'authorization_code') {
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code grant is supported'
        });
        return;
      }

      // Retrieve authorization session
      const session = authorizationCodes.get(code);
      if (!session) {
        logger.authFailure('invalid_authorization_code', req.ip);
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code'
        });
        return;
      }

      // Verify PKCE code verifier
      if (!verifyCodeChallenge(code_verifier, session.codeChallenge, session.codeChallengeMethod)) {
        logger.authFailure('invalid_code_verifier', req.ip);
        authorizationCodes.delete(code); // Prevent retry attacks
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid code_verifier'
        });
        return;
      }

      // Verify client_id matches
      if (client_id !== session.clientId) {
        logger.authFailure('client_id_mismatch', req.ip);
        authorizationCodes.delete(code);
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'client_id mismatch'
        });
        return;
      }

      // Verify redirect_uri matches (if provided)
      if (redirect_uri && redirect_uri !== session.redirectUri) {
        logger.authFailure('redirect_uri_mismatch', req.ip);
        authorizationCodes.delete(code);
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'redirect_uri mismatch'
        });
        return;
      }

      // Delete authorization code (one-time use)
      authorizationCodes.delete(code);

      // Generate access token
      const accessToken = generateRandomString(48);
      const expiresIn = 3600; // 1 hour

      // Store access token
      accessTokens.set(accessToken, {
        token: accessToken,
        clientId: client_id,
        scope: session.scope,
        resource: session.resource,
        expiresAt: Date.now() + (expiresIn * 1000),
        createdAt: Date.now()
      });

      logger.authAttempt(true, req.ip, client_id);
      logger.info('Issued access token:', {
        tokenPreview: accessToken.substring(0, 10) + '...',
        expiresIn,
        scope: session.scope
      });

      // Return access token
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: session.scope || undefined
      });

    } catch (error) {
      logger.error('Error in /token endpoint:', {}, error as Error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  };
}

/**
 * OAuth Bearer token validation middleware
 */
export function validateBearerToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid Authorization header'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const tokenData = accessTokens.get(token);

    if (!tokenData) {
      logger.authFailure('invalid_access_token', req.ip);
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired access token'
      });
      return;
    }

    // Check if token expired
    if (Date.now() > tokenData.expiresAt) {
      accessTokens.delete(token);
      logger.authFailure('expired_access_token', req.ip);
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token has expired'
      });
      return;
    }

    logger.info('Valid access token:', {
      clientId: tokenData.clientId,
      scope: tokenData.scope
    });

    // Token is valid, continue to next middleware
    next();

  } catch (error) {
    logger.error('Error validating bearer token:', {}, error as Error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
}

/**
 * Protected Resource Metadata (RFC 9728)
 */
export function handleProtectedResourceMetadata(baseUrl: string, authServerUrl: string) {
  return (req: Request, res: Response) => {
    res.json({
      resource: baseUrl,
      authorization_servers: [authServerUrl],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header']
    });
  };
}

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 */
export function handleAuthorizationServerMetadata(baseUrl: string) {
  return (req: Request, res: Response) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code'],
      response_types_supported: ['code'],
      scopes_supported: ['mcp', 'claudeai'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: false
    });
  };
}
