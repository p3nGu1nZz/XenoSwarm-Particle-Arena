import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon,
  className = '',
  style,
  ...props 
}) => {
  
  const variants = {
    primary: "bg-cyan-500 text-black border-cyan-400 hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(0,243,255,0.6)]",
    secondary: "bg-transparent text-cyan-400 border-cyan-500/30 hover:bg-cyan-900/20 hover:border-cyan-400 hover:text-cyan-200",
    danger: "bg-transparent text-red-500 border-red-500/50 hover:bg-red-900/20 hover:border-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    ghost: "bg-transparent text-neutral-400 border-transparent hover:text-white"
  };

  const sizes = {
    sm: "px-4 py-1 text-[10px] h-8",
    md: "px-8 py-3 text-xs h-12",
    lg: "px-10 py-4 text-sm h-16 tracking-widest"
  };

  const baseClass = "relative group inline-flex items-center justify-center font-bold uppercase transition-all duration-200 brand-font border";
  
  // Cyberpunk clip-path
  const clipStyle = variant === 'ghost' ? {} : { 
      clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)"
  };

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ ...clipStyle, ...style }}
      {...props}
    >
        {/* Background animation for non-ghost */}
        {variant !== 'ghost' && (
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}></div>
        )}
        
        {/* Corner Accents */}
        {variant !== 'ghost' && (
            <>
                <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-current opacity-70"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-current opacity-70"></div>
            </>
        )}

        {/* Content */}
        <div className="relative z-10 flex items-center gap-2 group-hover:gap-3 transition-all duration-300">
            {icon && <span className="group-hover:text-white transition-colors">{icon}</span>}
            <span className={variant === 'primary' ? '' : 'group-hover:text-shadow-glow'}>{children}</span>
        </div>
    </button>
  );
};

export default Button;