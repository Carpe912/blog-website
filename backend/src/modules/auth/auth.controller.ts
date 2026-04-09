import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() body: { password: string }) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (body.password !== adminPassword) {
      throw new UnauthorizedException('密码错误');
    }
    // 简单 token：生产环境请替换为 JWT
    const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
    return { token };
  }
}
