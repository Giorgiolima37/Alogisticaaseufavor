import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabase';

export default function HomeScreen() {
  const router = useRouter();
  const [utilizador, setUtilizador] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState('');

  const [modalVisivel, setModalVisivel] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState('');

  // Novo estado para a lista de motoristas
  const [listaMotoristas, setListaMotoristas] = useState<any[]>([]);

  useEffect(() => {
    async function carregarDados() {
      // Carregar Frota
      try {
        const frotaSalva = await AsyncStorage.getItem('@frota_cache');
        if (frotaSalva) {
          setVeiculos(JSON.parse(frotaSalva));
        }
      } catch (e) {
        console.log("Erro ao ler cache inicial", e);
      }

      try {
        const { data, error } = await supabase
          .from('veiculos')
          .select(`
            *,
            motoristas:motorista_atual_id (nome)
          `)
          .order('placa', { ascending: true });

        if (!error && data) {
          setVeiculos(data);
          await AsyncStorage.setItem('@frota_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.log("Sem internet para atualizar frota, usando dados em cache.", err);
      }

      // Carregar Lista de Motoristas para o campo Utilizador
      try {
        const { data: motoristasData, error: motoristasError } = await supabase
          .from('motoristas')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (!motoristasError && motoristasData) {
          setListaMotoristas(motoristasData);
        }
      } catch (err) {
        console.log("Erro ao carregar motoristas", err);
      }
    }
    
    carregarDados();
  }, []);

  async function fazerLogin() {
    if (!utilizador || !senha || !veiculoSelecionado) {
      Alert.alert("Atenção", "Preencha usuário, senha e selecione o veículo!");
      return;
    }

    setCarregando(true);

    try {
      // AJUSTE: Agora buscamos pelo ID selecionado no Picker, garantindo precisão
      const { data: motorista, error: erroMotorista } = await supabase
        .from('motoristas')
        .select('*')
        .eq('id', utilizador) // 'utilizador' agora armazena o ID
        .eq('senha', senha)
        .eq('ativo', true)
        .maybeSingle();

      if (erroMotorista) throw erroMotorista;

      if (motorista) {
        const { data: veiculoStatus, error: erroBusca } = await supabase
          .from('veiculos')
          .select('motorista_atual_id')
          .eq('placa', veiculoSelecionado)
          .single();

        if (erroBusca) throw erroBusca;

        if (veiculoStatus?.motorista_atual_id && veiculoStatus.motorista_atual_id !== motorista.id) {
          setCarregando(false);
          Alert.alert("Veículo Ocupado", "Este veículo já está sendo usado por outro motorista.");
          return;
        }

        const { data: motoristaEmOutro, error: erroCheckMotorista } = await supabase
          .from('veiculos')
          .select('placa')
          .eq('motorista_atual_id', motorista.id)
          .neq('placa', veiculoSelecionado)
          .maybeSingle();

        if (erroCheckMotorista) throw erroCheckMotorista;

        if (motoristaEmOutro) {
          setCarregando(false);
          Alert.alert("Acesso Negado", `Você já tem uma rota aberta no veículo ${motoristaEmOutro.placa}.`);
          return;
        }

        const { error: erroVinculo } = await supabase
          .from('veiculos')
          .update({ 
            motorista_atual_id: motorista.id,
            em_uso: true 
          })
          .eq('placa', veiculoSelecionado);

        if (erroVinculo) {
          setCarregando(false);
          Alert.alert("Erro de Vínculo", "Não foi possível registrar o uso do veículo no banco.");
          return;
        }

        const { data: rotaAtiva } = await supabase
          .from('rotas_diarias')
          .select('*')
          .eq('motorista_id', motorista.id)
          .eq('status', 'em_andamento')
          .maybeSingle();

        let rotaFinal = rotaAtiva;

        if (!rotaAtiva) {
          const { data: novaRota, error: erroRota } = await supabase
            .from('rotas_diarias')
            .insert([{
              motorista_id: motorista.id,
              veiculo_placa: veiculoSelecionado, 
              status: 'em_andamento',
              data_inicio: new Date().toISOString()
            }])
            .select()
            .single();
          
          rotaFinal = novaRota;
          if (erroRota) console.log("Erro ao criar registro de rota.", erroRota.message);
        } else {
          await supabase
            .from('rotas_diarias')
            .update({ veiculo_placa: veiculoSelecionado })
            .eq('id', rotaAtiva.id);
        }

        const dadosSessao = {
          id: motorista.id,
          nome: motorista.nome,
          senha: senha,
          veiculo: veiculoSelecionado,
          rota_id: rotaFinal?.id, 
          logadoEm: new Date().toISOString()
        };

        // GRAVAÇÃO DA SESSÃO REFORÇADA COM O ID CORRETO
        await AsyncStorage.setItem('@sessao_motorista', JSON.stringify(dadosSessao));
        await AsyncStorage.setItem('@ultimo_motorista_validado', JSON.stringify({ nome: motorista.nome, senha: senha }));

        setCarregando(false);

        if (rotaAtiva) {
          router.replace({ 
            pathname: '/lista_rota', 
            params: { 
                entregas: JSON.stringify(rotaAtiva.lista_entregas || []),
                motorista_id: motorista.id // Passagem explícita do ID para a próxima tela
            } 
          });
        } else {
          router.replace('/dados_entrega');
        }

      } else {
        throw new Error('Incorreto');
      }

    } catch (error: any) {
      setCarregando(false);
      Alert.alert("Erro de Acesso", "Usuário/Senha incorretos ou acesso desativado.");
    }
  }

  const validarAdmin = () => {
    if (senhaAdmin === '1234') {
      setModalVisivel(false);
      setSenhaAdmin('');
      router.push('/admin');
    } else {
      Alert.alert("Erro", "Senha administrativa incorreta.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        <ImageBackground 
          source={require('../../assets/fundo.png')} 
          style={styles.header}
          resizeMode="cover"
        >
          <Text style={styles.headerText}> </Text>
        </ImageBackground>

        <View style={styles.card}>
          
          <Text style={styles.label}>Utilizador</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.pickerIcon} />
            <Picker
              selectedValue={utilizador}
              onValueChange={(itemValue) => setUtilizador(itemValue)}
              style={styles.picker}
              dropdownIconColor="#666"
            >
              <Picker.Item label="Selecionar utilizador..." value="" color="#999" />
              {listaMotoristas.map((m) => (
                <Picker.Item 
                  key={m.id} 
                  label={m.nome} 
                  value={m.id} // AJUSTE: Agora o valor é o ID, não o nome
                />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              secureTextEntry={true}
              value={senha}
              onChangeText={setSenha}
            />
          </View>

          <Text style={styles.label}>Veículo na Frota</Text>
          <View style={styles.pickerWrapper}>
            <Ionicons name="bus-outline" size={20} color="#666" style={styles.pickerIcon} />
            <Picker
              selectedValue={veiculoSelecionado}
              onValueChange={(itemValue) => setVeiculoSelecionado(itemValue)}
              style={styles.picker}
              dropdownIconColor="#666"
            >
              <Picker.Item label="Selecionar veículo..." value="" color="#999" />
              {veiculos.map((v) => {
                const motoristaNome = v.motoristas?.nome;
                const labelStatus = motoristaNome ? `(${motoristaNome})` : "(Livre)";
                
                return (
                  <Picker.Item 
                    key={v.id} 
                    label={`${v.placa} - ${v.modelo} ${labelStatus}`} 
                    value={v.placa}
                    color={motoristaNome ? "#ff4444" : "#222"}
                  />
                );
              })}
            </Picker>
          </View>

          <TouchableOpacity 
            style={[styles.button, { opacity: carregando ? 0.7 : 1 }]} 
            onPress={fazerLogin}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.buttonSecondary} 
            onPress={() => router.push('/rotas_prontas')}
          >
            <Text style={styles.buttonSecondaryText}>Rotas prontas</Text>
          </TouchableOpacity>

        </View>

        <TouchableOpacity 
          style={styles.footerLink} 
          onPress={() => setModalVisivel(true)}
        >
          <Text style={styles.footerText}>ACESSO PROPRIETÁRIO</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.supportContainer} 
          onPress={() => console.log('Abrir Suporte')}
        >
          <Ionicons name="headset-outline" size={21} color="#666" />
          <Text style={styles.supportText}>Suporte Técnico</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisivel} onRequestClose={() => setModalVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark" size={40} color="#0095ff" />
              <Text style={styles.modalTitle}>Área Restrita</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Senha Admin"
              secureTextEntry={true}
              value={senhaAdmin}
              onChangeText={setSenhaAdmin}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisivel(false)}>
                <Text style={styles.txtCancelar}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnEntrarModal} onPress={validarAdmin}>
                <Text style={styles.txtEntrarModal}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F6' },
  scrollContainer: { flexGrow: 1, alignItems: 'center' },
  header: { backgroundColor: '#0033ff', width: '100%', height: 200, paddingTop: 45, justifyContent: 'center', alignItems: 'center' },
  headerText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  card: { backgroundColor: '#FFF', width: '90%', marginTop: -15, borderRadius: 20, padding: 25, elevation: 5 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 15 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CCC', borderRadius: 10, paddingHorizontal: 15, height: 55, backgroundColor: '#FAFAFA' },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  pickerWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CCC', borderRadius: 10, height: 55, backgroundColor: '#FAFAFA', paddingLeft: 15 },
  pickerIcon: { marginRight: 5 },
  picker: { flex: 1, marginLeft: -10 },
  button: { backgroundColor: '#0033ff', height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  buttonSecondary: { height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#DDD' },
  buttonSecondaryText: { color: '#666', fontSize: 15, fontWeight: '500' },
  footerLink: { marginTop: 40, marginBottom: 65 },
  footerText: { color: '#666', fontWeight: '600', letterSpacing: 1 },
  supportContainer: { alignItems: 'center', marginBottom: 20, marginTop: -35 },
  supportText: { color: '#666', fontSize: 12, marginTop: 5, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 25, padding: 20, alignItems: 'center', elevation: 10 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, color: '#444', marginTop: 10 },
  modalInput: { width: '100%', height: 50, borderWidth: 1, borderColor: '#DDD', borderRadius: 12, paddingHorizontal: 15, fontSize: 16, backgroundColor: '#F9F9F9', marginBottom: 20, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 10 },
  btnCancelar: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center' },
  btnEntrarModal: { flex: 1, backgroundColor: '#0033ff', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txtCancelar: { color: '#666', fontSize: 16, fontWeight: '500' },
  txtEntrarModal: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});