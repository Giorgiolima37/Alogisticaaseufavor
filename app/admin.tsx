import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminScreen() {
  const router = useRouter();

  // Componente para os itens do menu ajustado para aceitar cliques (onPress)
  const MenuItem = ({ icon, title, onPress }: { icon: any, title: string, onPress?: () => void }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={24} color="#006699" style={styles.menuIcon} />
        <Text style={styles.menuText}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho com botão voltar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()}>
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>    Painel do Proprietário</Text>
        <View style={{ width: 24 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>       Gestão da Empresa</Text>
        <Text style={styles.headerSubtitle}>   Configurações administrativas e segurança.</Text>

        <View style={styles.menuContainer}>
          {/* Botão Motoristas */}
          <MenuItem 
            icon="people-outline" 
            title="Motoristas Cadastrados" 
            onPress={() => router.push('/motoristas')}
          />
          
          {/* AJUSTE REALIZADO: Agora aponta para uma nova tela vazia */}
          <MenuItem 
            icon="git-network-outline" 
            title="Gerenciamento de Rota" 
            onPress={() => router.push('/gestao_rotas')}
          />

          <MenuItem icon="lock-closed-outline" title="Alterar Senha de Acesso" />
          
          {/* Botão Gerenciar Frota */}
          <MenuItem 
            icon="help-circle-outline" 
            title="Gerenciar Frota" 
            onPress={() => router.push('/frota')}
          />
          
          <MenuItem icon="business-outline" title="Configurações da Empresa" />
        </View>

        {/* Botão Sair */}
        <TouchableOpacity 
          style={styles.btnSair} 
          onPress={() => router.replace('/')}
        >
          <Text style={styles.txtSair}>Sair do Painel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  navbar: {
   marginTop: 30, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 35,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  navbarTitle: { fontSize: 18, fontWeight: '500', color: '#444' },
  content: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 16, color: '#888', marginBottom: 30 },
  menuContainer: { gap: 12 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { marginRight: 15 },
  menuText: { fontSize: 16, color: '#444', fontWeight: '500' },
  btnSair: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#002fff',
    borderRadius: 12,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txtSair: { color: '#001aff', fontSize: 16, fontWeight: 'bold' },
});