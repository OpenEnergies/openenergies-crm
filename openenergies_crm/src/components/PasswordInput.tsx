// src/components/PasswordInput.tsx
import React, { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

// Definimos los props, que incluirán todos los atributos de un input
interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  // No necesitamos props extra, react-hook-form las pasará
}

// Usamos forwardRef para pasar la 'ref' de react-hook-form al input interno
const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleShowPassword = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="input-icon-wrapper">
        {/* Icono de candado (fijo a la izquierda) */}
        <Lock size={18} className="input-icon" />
        
        <input
          type={showPassword ? 'text' : 'password'}
          // Combinamos clases: la que pasamos y la nuestra para el padding
          className={`password-input-with-toggle ${className || ''}`}
          {...props} // Pasa todos los props (id, placeholder, ...register, etc.)
          ref={ref}   // Pasa el ref de register al input
        />

        {/* Botón para mostrar/ocultar (ojo) */}
        <button
          type="button"
          onClick={toggleShowPassword}
          className="password-toggle-button" // Clase CSS dedicada
          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          tabIndex={-1} // Evita que el botón sea parte del 'tab' normal
        >
          {showPassword ? <EyeOff size={36} /> : <Eye size={36} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput'; // Buenas prácticas para React DevTools
export default PasswordInput;