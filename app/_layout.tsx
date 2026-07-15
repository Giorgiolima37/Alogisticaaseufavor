import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { supabase } from './supabase';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // 1. Verificar sessÃƒÆ’Ã‚Â£o inicial
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleNavigation(session);
      setIsAuthReady(true);
    };

    // 2. Ouvir mudanÃƒÆ’Ã‚Â§as na autenticaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o (Login/Logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleNavigation(session);
    });

    checkInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [segments, isAuthReady]);

  // FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o centralizada de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
  const handleNavigation = (session: any) => {
    if (!isAuthReady) return; // Espera o app carregar o estado inicial

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(tabs)';
    
    // DEFINA AS TELAS QUE NÃƒÆ’Ã†â€™O EXIGEM SESSÃƒÆ’Ã†â€™O OFICIAL DO SUPABASE
    // Mantem as telas publicas existentes, sem trocar a entrada principal do app.
    const isAllowedWithoutAuth = [
      'admin', 
      'motoristas', 
      'frota', 
      'dados_entrega', 
      'lista_rota',
      'gestao_rotas',
      'rotas_prontas'
    ].includes(firstSegment);

    if (session && (inAuthGroup || firstSegment === 'accounts')) {
      // Se houver login oficial via Supabase, redireciona para Entregas
      router.replace('/dados_entrega');
    } 
    else if (!session && !inAuthGroup && !isAllowedWithoutAuth) {
      // Sem sessao, volta para a tela inicial antiga de motorista.
      router.replace('/');
    }
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Definindo as rotas explicitamente */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="accounts/signin" options={{ headerShown: false }} />
        <Stack.Screen name="dados_entrega" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="motoristas" options={{ headerShown: false }} />
        <Stack.Screen name="frota" options={{ headerShown: false }} />
        <Stack.Screen name="lista_rota" options={{ headerShown: false }} />
        <Stack.Screen name="rotas_prontas" options={{ headerShown: false }} />
        
        {/* REGISTRADO: Nova tela de GestÃƒÆ’Ã‚Â£o de Rotas ajustada para remover a seta nativa */}
        <Stack.Screen 
          name="gestao_rotas" 
          options={{ 
            headerShown: false,      // Esconde o cabeÃƒÆ’Ã‚Â§alho onde a seta fica
            headerLeft: () => null,  // Remove explicitamente qualquer ÃƒÆ’Ã‚Â­cone ÃƒÆ’Ã‚Â  esquerda
            gestureEnabled: false    // Desativa o gesto de deslizar para voltar no iOS
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
