'use client';

export default function Home() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'black',
        color: 'lime',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '48px',
        fontWeight: 'bold',
        zIndex: 999999,
      }}
    >
      VERSION 777
    </div>
  );
}