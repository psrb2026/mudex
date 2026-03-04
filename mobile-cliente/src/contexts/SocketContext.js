import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext({});

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // AJUSTE: Usando seu IP 192.168.15.6 na porta do Gateway (3000)
    const newSocket = io('http://192.168.15.6:3000', {
      transports: ['websocket'],
      query: user ? { userId: user.id } : {},
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  return useContext(SocketContext);
}