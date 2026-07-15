import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from './supabase';

// NOVA FUNÇÃO: Extrai a data ignorando o fuso horário do celular que causava o recuo de 1 dia
const formatarDataBrasil = (dataString: string | null) => {
  if (!dataString) return new Date().toLocaleDateString('pt-BR');
  try {
    const dataParte = dataString.split('T')[0]; // Pega apenas 'YYYY-MM-DD'
    const [ano, mes, dia] = dataParte.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    return new Date(dataString).toLocaleDateString('pt-BR');
  }
};

export default function GestaoRotasScreen() {
  const router = useRouter();
  
  const [rotasOriginais, setRotasOriginais] = useState<any[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<any[]>([]);
  const [textoFiltro, setTextoFiltro] = useState('');
  
  const [dataFiltro, setDataFiltro] = useState<Date | null>(null);
  const [exibirCalendario, setExibirCalendario] = useState(false);
  
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const [idAtendimentoAtivo, setIdAtendimentoAtivo] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function buscarHistoricoRotas() {
    try {
      const { data, error } = await supabase
        .from('entregas') 
        .select(`
          *,
          motoristas (
            nome,
            ativo,
            rotas_diarias (
              veiculo_placa
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setRotasOriginais(data || []);
      setRotasFiltradas(data || []);
      
    } catch (err) {
      console.log("Erro ao buscar placa, ativando modo de segurança:", err);
      
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('entregas')
          .select('*, motoristas(nome, ativo)')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        setRotasOriginais(fallbackData || []);
        setRotasFiltradas(fallbackData || []);
      } catch (errFallback) {
        Alert.alert("Erro", "Falha ao carregar o histórico.");
      }

    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    let dados = [...rotasOriginais];

    // 1. Filtra pela data do calendário
    if (dataFiltro) {
      const dataStringFiltro = dataFiltro.toLocaleDateString('pt-BR');
      dados = dados.filter(item => {
        const dataItem = formatarDataBrasil(item.data_entrega);
        return dataItem === dataStringFiltro;
      });
    }

    // 2. Filtra pelo texto digitado
    if (textoFiltro.trim() !== '') {
      const termoBusca = textoFiltro.toLowerCase();
      dados = dados.filter((item) => {
        const nomeMotorista = item.motoristas?.nome?.toLowerCase() || 'desligado';
        
        let placaVeiculo = '';
        const rotasDoMotorista = item.motoristas?.rotas_diarias;
        if (rotasDoMotorista && Array.isArray(rotasDoMotorista) && rotasDoMotorista.length > 0) {
          placaVeiculo = rotasDoMotorista[0]?.veiculo_placa?.toLowerCase() || '';
        }

        const dataFormatada = formatarDataBrasil(item.data_entrega);

        return (
          nomeMotorista.includes(termoBusca) || 
          placaVeiculo.includes(termoBusca) || 
          dataFormatada.includes(termoBusca)
        );
      });
    }

    setRotasFiltradas(dados);
  }, [textoFiltro, dataFiltro, rotasOriginais]);

  const onChangeData = (event: any, selectedDate?: Date) => {
    setExibirCalendario(false); 
    if (selectedDate) {
      setDataFiltro(selectedDate);
    }
  };

  const limparFiltroData = () => {
    setDataFiltro(null);
    setTextoFiltro('');
  };

  useEffect(() => {
    if (idAtendimentoAtivo) {
      timerRef.current = setInterval(() => {
        setSegundos((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSegundos(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [idAtendimentoAtivo]);

  const formatarTempo = (s: number) => {
    const mins = Math.floor(s / 60);
    const segs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  const iniciarAtendimento = (id: string) => {
    setIdAtendimentoAtivo(id);
    setSegundos(0);
  };

  const finalizarAtendimento = async (id: string) => {
    const tempoFinal = formatarTempo(segundos);
    
    const { error } = await supabase
      .from('entregas')
      .update({ 
        tempo_permanencia: tempoFinal, 
        status: 'Finalizado',
        data_entrega: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      Alert.alert("Erro", "Não foi possível salvar o tempo de permanência.");
    } else {
      Alert.alert("Sucesso", `Atendimento finalizado em ${tempoFinal}`);
      setIdAtendimentoAtivo(null);
      buscarHistoricoRotas();
    }
  };

  async function apagarRotaIndividual(id: string, nomeLocal: string) {
    Alert.alert(
      "Confirmar Exclusão",
      `Deseja apagar o registro de "${nomeLocal}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Apagar", 
          style: "destructive", 
          onPress: async () => {
            const { error } = await supabase.from('entregas').delete().eq('id', id);
            if (error) {
              Alert.alert("Erro", "Não foi possível apagar este registro.");
            } else {
              buscarHistoricoRotas();
            }
          } 
        }
      ]
    );
  }

  async function apagarTodoHistorico() {
    Alert.alert(
      "AVISO CRÍTICO",
      "Isso apagará TODAS as rotas registradas permanentemente. Confirmar?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "APAGAR TUDO", 
          style: "destructive", 
          onPress: async () => {
            setCarregando(true);
            const { error } = await supabase.from('entregas').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
            if (error) {
              Alert.alert("Erro", "Falha ao limpar histórico.");
            } else {
              Alert.alert("Sucesso", "Todo o histórico foi removido.");
              buscarHistoricoRotas();
            }
          } 
        }
      ]
    );
  }

  useEffect(() => {
    buscarHistoricoRotas();
  }, []);

  const onRefresh = () => {
    setAtualizando(true);
    buscarHistoricoRotas();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.replace('/admin')}>
          <Ionicons name="chevron-back" size={24} color="#000" />
          <Text style={styles.txtBack}>Painel</Text>
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>Gestão de Rotas</Text>
        
        {rotasOriginais.length > 0 && (
          <TouchableOpacity onPress={apagarTodoHistorico} style={styles.btnTrashAll}>
            <Ionicons name="trash-bin-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtroContainer}>
        <View style={styles.inputBuscaArea}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput 
            style={styles.inputBusca}
            placeholder="Filtrar por motorista, placa ou data..."
            value={textoFiltro}
            onChangeText={setTextoFiltro}
            autoCapitalize="none"
          />
          {(textoFiltro.length > 0 || dataFiltro) && (
            <TouchableOpacity onPress={limparFiltroData}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={onRefresh} color="#006699" />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>        Histórico de Entregas</Text>
          <TouchableOpacity onPress={() => setExibirCalendario(true)}>
            <Ionicons 
              name="calendar-outline" 
              size={30} 
              color={dataFiltro ? "#006699" : "#333"} 
              style={styles.headerIcon} 
            />
          </TouchableOpacity>
        </View>

        {dataFiltro && (
          <Text style={styles.txtFiltroAtivo}>Filtrando pela data: {dataFiltro.toLocaleDateString('pt-BR')}</Text>
        )}

        <Text style={styles.headerSubtitle}>          Visualize e gerencie o desempenho das rotas.</Text>

        {exibirCalendario && (
          <DateTimePicker
            value={dataFiltro || new Date()}
            mode="date"
            display="default"
            onChange={onChangeData}
          />
        )}

        {carregando ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#006699" /></View>
        ) : rotasFiltradas.length === 0 ? (
          <View style={styles.placeholder}>
            <Ionicons name="document-text-outline" size={50} color="#CCC" />
            <Text style={styles.placeholderText}>
              {rotasOriginais.length === 0 ? "Nenhuma rota registrada." : "Nenhum resultado para o filtro."}
            </Text>
          </View>
        ) : (
          rotasFiltradas.map((item, index) => {
            const isClienteFechado = item.status === 'Cliente Fechado';
            const isRecusouReceber = item.status === 'Recusou Receber';

            // LOGICA PARA IDENTIFICAR MOTORISTA E STATUS ATIVO/DESLIGADO
            const motoristaNome = item.motoristas?.nome || 'Não identificado';
            const isMotoristaAtivo = item.motoristas?.ativo !== false; // Considera ativo se não for explicitamente false

            let placaVeiculo = '';
            const rotasDoMotorista = item.motoristas?.rotas_diarias;
            if (rotasDoMotorista && Array.isArray(rotasDoMotorista) && rotasDoMotorista.length > 0) {
              placaVeiculo = rotasDoMotorista[0]?.veiculo_placa || '';
            }

            return (
              <View 
                key={item.id || index} 
                style={[
                  styles.cardRota, 
                  idAtendimentoAtivo === item.id && styles.cardAtivo,
                  isClienteFechado && styles.cardClienteFechado,
                  isRecusouReceber && styles.cardRecusouReceber
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txtEstabelecimento} numberOfLines={1}>{item.estabelecimento}</Text>
                    
                    <View style={styles.motoristaRow}>
                      <Ionicons name="person-circle-outline" size={14} color={isMotoristaAtivo ? "#666" : "#FF3B30"} />
                      
                      {/* AJUSTE SOLICITADO: Se motorista inativo, exibe "Nome/Removido" em vermelho */}
                      <Text style={[styles.txtMotorista, !isMotoristaAtivo && { color: '#FF3B30', fontWeight: 'bold' }]}>
                        Motorista: {motoristaNome}{!isMotoristaAtivo ? '/Removido' : ''} {placaVeiculo ? ` | Placa: ${placaVeiculo}` : ''}
                      </Text>
                    </View>

                    <Text style={styles.txtData}>
                      {formatarDataBrasil(item.data_entrega)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    onPress={() => apagarRotaIndividual(item.id, item.estabelecimento)}
                    style={styles.btnDeleteIndividual}
                  >
                    <Ionicons name="trash-outline" size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <View style={[
                  styles.divider, 
                  isClienteFechado && { backgroundColor: '#ffcccc' },
                  isRecusouReceber && { backgroundColor: '#ffe0b2' }
                ]} />

                {idAtendimentoAtivo === item.id ? (
                  <View style={styles.timerContainer}>
                    <Text style={styles.timerLabel}>ATENDIMENTO INICIADO</Text>
                    <Text style={styles.timerValue}>{formatarTempo(segundos)}</Text>
                    <TouchableOpacity 
                      style={styles.btnFinalizar} 
                      onPress={() => finalizarAtendimento(item.id)}
                    >
                      <Text style={styles.txtBtnFinalizar}>FINALIZAR ATENDIMENTO</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.detalhesRow}>
                    <View style={styles.detalheItem}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.txtDetalheValor}>{item.tempo_permanencia || '--'}</Text>
                    </View>

                    <View style={styles.detalheItem}>
                      <Ionicons 
                        name={item.avaria ? "warning" : "checkmark-circle"} 
                        size={16} 
                        color={item.avaria ? "#FF3B30" : "#28a745"} 
                      />
                      <Text style={[styles.txtDetalheValor, item.avaria && { color: '#FF3B30' }]}>
                        Avaria: {item.avaria ? "Sim" : "Não"}
                      </Text>
                    </View>
                    
                    {!item.tempo_permanencia && (
                      <TouchableOpacity onPress={() => iniciarAtendimento(item.id)}>
                          <Ionicons name="play-circle" size={24} color="#006699" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={[
                  styles.statusFooter, 
                  isClienteFechado && { borderTopColor: '#ffcccc' },
                  isRecusouReceber && { borderTopColor: '#ffe0b2' }
                ]}>
                  <Text style={[
                    styles.txtStatus, 
                    isClienteFechado && { color: '#d32f2f' },
                    isRecusouReceber && { color: '#e65100' }
                  ]}>
                    Status: {idAtendimentoAtivo === item.id ? 'Em progresso...' : (item.status || 'Finalizado')}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  navbar: { marginTop: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  btnBack: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 20 },
  txtBack: { fontSize: 14, fontWeight: '500' },
  navbarTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 15, flex: 1 },
  btnTrashAll: { padding: 8 },
  filtroContainer: { paddingHorizontal: 20, paddingTop: 15, backgroundColor: '#F8F9FA' },
  inputBuscaArea: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9ECEF', borderRadius: 12, paddingHorizontal: 12, height: 45, borderWidth: 1, borderColor: '#DEE2E6' },
  inputBusca: { flex: 1, marginLeft: 10, fontSize: 14, color: '#333' },
  content: { padding: 20, paddingTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerIcon: { marginLeft: 20 },
  headerSubtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  txtFiltroAtivo: { color: '#006699', fontWeight: 'bold', fontSize: 12, marginLeft: 30, marginBottom: 5 },
  cardRota: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3, borderWidth: 1, borderColor: '#EEE' },
  cardAtivo: { borderColor: '#006699', borderWidth: 2, backgroundColor: '#F0F8FF' },
  cardClienteFechado: { backgroundColor: '#ffebee', borderColor: '#ffcccc', borderWidth: 1 },
  cardRecusouReceber: { backgroundColor: '#fff3e0', borderColor: '#ffe0b2', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txtEstabelecimento: { fontSize: 16, fontWeight: 'bold', color: '#006699' },
  motoristaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  txtMotorista: { fontSize: 13, color: '#666', fontWeight: '500' },
  txtData: { fontSize: 12, color: '#999', marginTop: 2 },
  btnDeleteIndividual: { padding: 5 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  detalhesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detalheItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  txtDetalheValor: { fontSize: 13, fontWeight: '500', color: '#444' },
  timerContainer: { alignItems: 'center', paddingVertical: 10 },
  timerLabel: { fontSize: 10, fontWeight: 'bold', color: '#006699', letterSpacing: 1 },
  timerValue: { fontSize: 32, fontWeight: 'bold', color: '#333', marginVertical: 5 },
  btnFinalizar: { backgroundColor: '#28a745', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 5 },
  txtBtnFinalizar: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  statusFooter: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F9F9F9' },
  txtStatus: { fontSize: 13, fontWeight: '600', color: '#555' },
  center: { marginTop: 50, alignItems: 'center' },
  placeholder: { marginTop: 100, alignItems: 'center' },
  placeholderText: { color: '#999', marginTop: 15, fontSize: 14 }
});