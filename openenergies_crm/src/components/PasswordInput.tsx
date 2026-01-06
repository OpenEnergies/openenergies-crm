// src/components/PasswordInput.tsx
import React, { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  showIcon?: boolean;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, showIcon = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleShowPassword = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="relative">
        {/* Icono de candado */}
        {/* Icono de candado */}
        {showIcon && (
          <Lock
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        )}

        <input
          type={showPassword ? 'text' : 'password'}
          className={`
            glass-input pr-12
            ${showIcon ? 'pl-10' : ''}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className || ''}
          `}
          {...props}
          ref={ref}
        />

        {/* Botón toggle */}
        <button
          type="button"
          onClick={toggleShowPassword}
          className="
            absolute right-2 top-1/2 -translate-y-1/2
            p-1.5 rounded-md
            text-gray-400 hover:text-white
            hover:bg-bg-intermediate
            transition-colors duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-fenix-500
          "
          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;