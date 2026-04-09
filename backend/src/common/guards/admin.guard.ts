import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Admin 路由守卫
 * 校验请求中是否携带有效的管理员 token（存于 cookie 或 Authorization header）
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 优先读 cookie，其次读 Authorization: Bearer <token>
    const token =
      request.cookies?.['admin_token'] ||
      request.headers.authorization?.replace('Bearer ', '');

    const validToken = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD || 'admin123';

    if (!token || token !== validToken) {
      throw new UnauthorizedException('请先登录管理后台');
    }

    return true;
  }
}
