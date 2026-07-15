import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';

export default function FrotaScreen() {
  const router = useRouter();
  
  // Estados para o formulário
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [carregando, setCarregando] = useState(false);
  
  // Estados para a lista e edição
  const [listaVeiculos, setListaVeiculos] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Função para buscar veículos no Supabase
  async function buscarFrota() {
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .order('placa', { ascending: true });

    if (!error && data) {
      setListaVeiculos(data);
    }
  }

  useEffect(() => {
    buscarFrota();
  }, []);

  // Prepara os dados para edição (ao clicar no lápis)
  function prepararEdicao(veiculo: any) {
    setPlaca(veiculo.placa);
    setModelo(veiculo.modelo);
    setEditandoId(veiculo.id);
  }

  function limparCampos() {
    setPlaca('');
    setModelo('');
    setEditandoId(null);
  }

  // NOVA FUNÇÃO: Deletar veículo da frota
  async function deletarVeiculo(id: string, placaVeiculo: string) {
    Alert.alert(
      "Confirmar Exclusão",
      `Deseja remover o veículo ${placaVeiculo} da frota?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('veiculos').delete().eq('id', id);
            if (error) {
              Alert.alert("Erro", "Não foi possível excluir o veículo.");
            } else {
              buscarFrota();
            }
          } 
        }
      ]
    );
  }

  async function gerenciarSalvar() {
    if (!placa || !modelo) {
      Alert.alert("Atenção", "Preencha a Placa e o Modelo!");
      return;
    }

    setCarregando(true);
    
    // CORREÇÃO: Enviamos apenas placa e modelo para não resetar o motorista_id
    const dados = { placa, modelo };

    try {
      if (editandoId) {
        const { error } = await supabase.from('veiculos').update(dados).eq('id', editandoId);
        if (error) throw error;
        Alert.alert("Sucesso", "Veículo atualizado!");
      } else {
        // Para novos veículos, garantimos que começam livres
        const { error } = await supabase.from('veiculos').insert([{ ...dados, em_uso: false }]);
        if (error) throw error;
        Alert.alert("Sucesso", "Veículo cadastrado na frota!");
      }

      limparCampos();
      buscarFrota();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#000" />
          <Text style={styles.txtBack}>Painel</Text>
        </TouchableOpacity>
        <Text style={styles.navbarTitle}> Gerenciar Frota</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Placa do Veículo</Text>
        <TextInput style={styles.input} placeholder="Ex: ABC-1234" value={placa} onChangeText={setPlaca} autoCapitalize="characters" />

        <Text style={styles.label}>Modelo / Marca</Text>
        <TextInput style={styles.input} placeholder="Ex: Volvo FH 540" value={modelo} onChangeText={setModelo} />

        <TouchableOpacity 
          style={[styles.btnSalvar, { backgroundColor: editandoId ? '#FF9800' : '#006699' }]} 
          onPress={gerenciarSalvar}
          disabled={carregando}
        >
          {carregando ? <ActivityIndicator color="#FFF" /> : (
            <Text style={styles.btnSalvarText}>{editandoId ? "ATUALIZAR VEÍCULO" : "CADASTRAR CAMINHÃO"}</Text>
          )}
        </TouchableOpacity>

        {editandoId && (
          <TouchableOpacity onPress={limparCampos} style={{ marginTop: 10 }}>
            <Text style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>Cancelar Edição</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />
        <Text style={styles.listaTitle}>Veículos na Frota</Text>

        {listaVeiculos.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum veículo cadastrado.</Text>
        ) : (
          <View style={{ marginTop: 15 }}>
            {listaVeiculos.map((v) => (
              <View key={v.id} style={styles.cardVeiculo}>
                <View style={styles.iconCirculo}>
                  <Ionicons name="bus" size={24} color="#006699" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txtPlaca}>{v.placa}</Text>
                  <Text style={styles.txtModelo}>{v.modelo}</Text>
                  {/* Badge de status para ajudar na conferência */}
                  <Text style={{ fontSize: 10, color: v.em_uso ? 'red' : 'green', fontWeight: 'bold' }}>
                    {v.em_uso ? '● EM USO' : '● LIVRE'}
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 15 }}>
                  <TouchableOpacity onPress={() => prepararEdicao(v)}>
                    <Ionicons name="create-outline" size={26} color="#006699" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => deletarVeiculo(v.id, v.placa)}>
                    <Ionicons name="trash-outline" size={26} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  navbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60, borderBottomWidth: 1, borderBottomColor: '#EEE', marginTop: 30 },
  btnBack: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 20 },
  txtBack: { fontSize: 14, fontWeight: '500', marginLeft: 2 },
  navbarTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 15 },
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, fontSize: 16, backgroundColor: '#FDFDFD' },
  btnSalvar: { height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnSalvarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#EEE', marginTop: 40, marginBottom: 20 },
  listaTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emptyText: { color: '#999', marginTop: 10, textAlign: 'center' },
  cardVeiculo: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  iconCirculo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2F7', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  txtPlaca: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  txtModelo: { fontSize: 13, color: '#666' }
});