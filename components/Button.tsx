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
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold uppercase tracking-wider transition-all duration-200 border transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]",
    secondary: "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-white",
    danger: "bg-red-600 border-red-500 text-white hover:bg-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]",
    ghost: "bg-transparent border-transparent text-neutral-400 hover:text-white"
  };

  const sizes = {
    sm: "text-xs px-3 py-1 gap-1.5",
    md: "text-sm px-5 py-2.5 gap-2",
    lg: "text-base px-8 py-3 gap-2.5"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};

export default Button;