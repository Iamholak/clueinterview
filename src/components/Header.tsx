import React from 'react';

interface HeaderProps {
  title: React.ReactNode;
}

export default function Header({ title }: HeaderProps) {
  return (
    <div className="header">
      <div className="header-title">{title}</div>
    </div>
  );
}
