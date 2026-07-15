import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';

export default function RotasProntasScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rotas, setRotas] = useState<any[]>([]);

  // Estados para o Modal de Senha
  const [modalVisible, setModalVisible] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [rotaSelecionada, setRotaSelecionada] = useState<any>(null);
  const [verificandoSenha, setVerificandoSenha] = useState(false);

  // Busca as rotas no banco de dados na tabela 'rotas_prontas'
  useEffect(() => {
    async function buscarRotas() {
      try {
        const { data, error } = await supabase
          .from('rotas_prontas') // Ajustado para a tabela correta das imagens
          .select('*')
          .eq('status', 'pronta'); 

        if (data) setRotas(data);
      } catch (err) {
        console.error("Erro ao carregar rotas:", err);
      } finally {
        setLoading(false);
      }
    }

    buscarRotas();
  }, []);

  // Função para abrir o modal de senha ao clicar em detalhes
  const abrirModalSenha = (rota: any) => {
    setRotaSelecionada(rota);
    setSenhaDigitada('');
    setModalVisible(true);
  };

  // Função para verificar a senha no Supabase e atualizar status do veículo
  const confirmarSenha = async () => {
    if (!senhaDigitada.trim()) {
      Alert.alert('Atenção', 'Por favor, digite a senha.');
      return;
    }

    if (!rotaSelecionada?.motorista_id) {
      Alert.alert('Erro', 'Esta rota não possui um motorista vinculado para validar a senha.');
      return;
    }

    setVerificandoSenha(true);

    try {
      // Busca a senha do motorista específico no banco de dados
      const { data, error } = await supabase
        .from('motoristas')
        .select('*') // Seleciona tudo para gravar na sessão
        .eq('id', rotaSelecionada.motorista_id)
        .single();

      if (error || !data) {
        Alert.alert('Erro', 'Motorista não encontrado no banco de dados.');
      } else if (data.senha !== senhaDigitada) {
        Alert.alert('Acesso Negado', 'Senha incorreta! Tente novamente.');
      } else {
        // --- INÍCIO DO AJUSTE: LOGIN AUTOMÁTICO E ATUALIZAÇÃO DO VEÍCULO ---
        
        // 1. Atualiza a placa do veículo para "em uso" e vincula o motorista atual
        if (rotaSelecionada.veiculo_placa) {
          await supabase
            .from('veiculos')
            .update({ 
              em_uso: true, 
              motorista_atual_id: rotaSelecionada.motorista_id 
            })
            .eq('placa', rotaSelecionada.veiculo_placa);
        }

        // 2. Grava a sessão do motorista (Simula o Login da tela inicial)
        const dadosSessao = {
          id: data.id,
          nome: data.nome,
          veiculo: rotaSelecionada.veiculo_placa,
          logadoEm: new Date().toISOString()
        };
        await AsyncStorage.setItem('@sessao_motorista', JSON.stringify(dadosSessao));

        // --- FIM DO AJUSTE ---

        // Senha correta - Fecha o modal e navega para a lista
        setModalVisible(false);
        router.push({ 
          pathname: '/lista_rota', 
          params: { 
            entregas: JSON.stringify(rotaSelecionada.lista_entregas || []),
            motorista_id: rotaSelecionada.motorista_id 
          } 
        });
      }
    } catch (err) {
      console.error("Erro ao verificar senha:", err);
      Alert.alert('Erro', 'Ocorreu um erro ao verificar a senha.');
    } finally {
      setVerificandoSenha(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Formatação da data de AAAA-MM-DD para DD/MM/AAAA
    const formatarData = (dataSql: string) => {
      if (!dataSql) return '--/--/----';
      const [ano, mes, dia] = dataSql.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    return (
      <View style={styles.row}>
        <Text style={[styles.cell, styles.dataCell]}>{formatarData(item.data_rota)}</Text>
        
        {/* INÍCIO DO AJUSTE: Agrupando Placa e Nome do Motorista */}
        <View style={{ width: '25%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.cell, { fontWeight: 'bold' }]}>{item.veiculo_placa || '---'}</Text>
          {item.motorista_nome && (
            <Text style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 2 }}>
              {item.motorista_nome}
            </Text>
          )}
        </View>
        {/* FIM DO AJUSTE */}

        <Text style={[styles.cell, styles.qtdCell]}>{item.lista_entregas?.length || 0} entregas</Text>
        <Text style={[styles.cell, styles.statusCell]}>PRONTA</Text>
        
        <View style={[styles.cell, styles.acoesCell]}>
          <TouchableOpacity 
            style={styles.btnDetalhes}
            // Alterado para abrir o modal em vez de ir direto
            onPress={() => abrirModalSenha(item)}
          >
            <Ionicons name="eye-outline" size={14} color="#333" />
            <Text style={styles.txtDetalhes}>Detalhes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Rotas prontas', 
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: '#0033ff' },
        headerTintColor: '#fff',
      }} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0033ff" />
          <Text style={styles.loadingText}>Buscando rotas...</Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {/* Cabeçalho da Tabela conforme a imagem */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.dataCell]}>DATA DA ROTA</Text>
            <Text style={[styles.headerCell, styles.placaCell]}>PLACA DO VEÍCULO</Text>
            <Text style={[styles.headerCell, styles.qtdCell]}>QTD ENTREGAS</Text>
            <Text style={[styles.headerCell, styles.statusCell]}>STATUS</Text>
            <Text style={[styles.headerCell, styles.acoesCell]}>AÇÕES</Text>
          </View>

          <FlatList
            data={rotas}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="alert-circle-outline" size={50} color="#CCC" />
                <Text style={styles.emptyText}>Nenhuma rota pronta encontrada.</Text>
              </View>
            }
          />
        </View>
      )}

      {/* MODAL DE SENHA FLUTUANTE */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="lock-closed-outline" size={40} color="#0033ff" style={{ marginBottom: 10 }} />
            <Text style={styles.modalTitle}>Acesso Restrito</Text>
            <Text style={styles.modalDescription}>
              Digite a senha do motorista <Text style={{ fontWeight: 'bold' }}>{rotaSelecionada?.motorista_nome || ''}</Text> para acessar os detalhes da rota.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Senha de acesso"
              secureTextEntry={true}
              value={senhaDigitada}
              onChangeText={setSenhaDigitada}
              keyboardType="default" // Ou "numeric" se a senha for apenas números
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setModalVisible(false)}
                disabled={verificandoSenha}
              >
                <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnConfirm]} 
                onPress={confirmarSenha}
                disabled={verificandoSenha}
              >
                {verificandoSenha ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalBtnTextConfirm}>Acessar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    margin: 10,
    marginTop: 40,
    borderRadius: 8,
    elevation: 2,
    overflow: 'hidden'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    textAlign: 'center',
  },
  cell: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
  },
  // Larguras das colunas para parecer uma tabela
  dataCell: { width: '20%', fontWeight: 'bold' },
  placaCell: { width: '25%', fontWeight: 'bold' },
  qtdCell: { width: '20%', color: '#666' },
  statusCell: { width: '15%', color: '#28a745', fontWeight: 'bold' },
  acoesCell: { width: '20%', flexDirection: 'row', justifyContent: 'center' },

  btnDetalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  txtDetalhes: {
    fontSize: 10,
    marginLeft: 3,
    color: '#333',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    textAlign: 'center',
  },

  // Estilos do Modal de Senha
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#EEE',
    marginRight: 10,
  },
  modalBtnConfirm: {
    backgroundColor: '#0033ff',
    marginLeft: 10,
  },
  modalBtnTextCancel: {
    color: '#555',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBtnTextConfirm: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});