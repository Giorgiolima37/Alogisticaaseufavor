import { useRouter } from 'expo-router';
import { supabase } from '../supabase';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AccountsSignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dados_entrega');
      }
    };
    checkSession();
  }, [router]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha email e senha para continuar.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Falha no login', error.message);
      return;
    }

    if (data?.session) {
      router.replace('/dados_entrega');
    } else {
      Alert.alert('Erro', 'Não foi possível autenticar. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Entrar na Conta</Text>
        <Text style={styles.subtitle}>Use seu email e senha para acessar o painel de entregas.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>ENTRAR</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/')}>
          <Text style={styles.linkText}>Entrar como motorista</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F6',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },
  button: {
    height: 55,
    backgroundColor: '#0033ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    color: '#0033ff',
    fontSize: 14,
    fontWeight: '600',
  },
});
