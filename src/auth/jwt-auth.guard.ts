// src/auth/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Para desarrollo y pruebas, permitimos todas las solicitudes
  // En producción, eliminarías esto y configurarías bien JWT
  canActivate(context: ExecutionContext) {
    // Bypass de autenticación para desarrollo local
    return true;
  }
}