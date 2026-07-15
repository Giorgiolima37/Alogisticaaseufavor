// =================================================================================================
// AVISO IMPORTANTE:
// Para que o recurso de arrastar e soltar (Drag and Drop) funcione, você precisa instalar 
// as seguintes bibliotecas no seu projeto Expo. Pare o servidor e rode o comando abaixo no terminal:
//
// npx expo install react-native-gesture-handler react-native-reanimated react-native-draggable-flatlist
//
// Depois, adicione 'react-native-reanimated/plugin' na array de plugins do seu babel.config.js
// =================================================================================================

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location'; // Biblioteca para GPS
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from './supabase';

// NOVAS IMPORTAÇÕES PARA O ARRASTAR E SOLTAR
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function ListaRotaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [entregas, setEntregas] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalNovoDestinoVisible, setModalNovoDestinoVisible] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState('');
  const [itemAtual, setItemAtual] = useState<any>(null);
  
  // NOVOS ESTADOS PARA OS CAMPOS SEPARADOS
  const [novoNome, setNovoNome] = useState('');
  const [novoCnpj, setNovoCnpj] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBairro, setNovoBairro] = useState('');
  const [novoMunicipio, setNovoMunicipio] = useState('');
  const [novoCep, setNovoCep] = useState('');
  
  const [buscandoNovoCnpj, setBuscandoNovoCnpj] = useState(false);
  // NOVO: Estado para a rodinha de carregamento do CEP no Modal
  const [buscandoCepModal, setBuscandoCepModal] = useState(false);

  const [novoAbre1, setNovoAbre1] = useState('');
  const [novoFecha1, setNovoFecha1] = useState('');
  const [novoAbre2, setNovoAbre2] = useState('');
  const [novoFecha2, setNovoFecha2] = useState('');

  const [editandoHorarioNoStatus, setEditandoHorarioNoStatus] = useState(false);

  const [horarioData, setHorarioData] = useState(new Date());
  const [mostrarRelogio, setMostrarRelogio] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [carregando, setCarregando] = useState(false);

  // ESTADOS PARA GESTÃO DE ROTA DETALHADA
  const [horaChegada, setHoraChegada] = useState<Date | null>(null);
  const [temAvaria, setTemAvaria] = useState(false);
  const [descricaoAvaria, setDescricaoAvaria] = useState('');

  // --- ESTADOS PARA O TEMPORIZADOR COM TRAVA DE SEGURANÇA ---
  const [atendimentoIniciado, setAtendimentoIniciado] = useState(false);
  const [segundosAtendimento, setSegundosAtendimento] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const todasFinalizadas = entregas.length > 0 && entregas.every(item => item.concluido === true);

  // Lógica do cronômetro ajustada para evitar crashes
  useEffect(() => {
    if (atendimentoIniciado && itemAtual) { 
      timerRef.current = setInterval(() => {
        setSegundosAtendimento((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [atendimentoIniciado, itemAtual]);

  const formatarCronometro = (totalSegs: number) => {
    const mins = Math.floor(totalSegs / 60);
    const segs = totalSegs % 60;
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  // --- FUNÇÃO PARA INICIAR A ROTA NO BANCO (TRANSFORMAR PRONTA EM DIÁRIA) ---
  const handleIniciarRotaBanco = async () => {
    setCarregando(true);
    try {
      // Tenta pegar da sessão salva no storage ou via parâmetros de navegação
      const sessaoRaw = await AsyncStorage.getItem('@sessao_motorista');
      let motoristaId = null;

      if (sessaoRaw) {
        const sessao = JSON.parse(sessaoRaw);
        motoristaId = sessao.id;
      } 
      
      // Fallback para o ID que veio da tela anterior se o storage falhar
      if (!motoristaId && params.motorista_id) {
        motoristaId = params.motorista_id;
      }

      if (!motoristaId) {
        Alert.alert("Erro", "Não foi possível identificar o motorista. Por favor, faça login novamente.");
        return;
      }

      // 1. Busca a rota pronta do motorista na tabela rotas_prontas
      const { data: rotaPronta, error: errorBusca } = await supabase
        .from('rotas_prontas')
        .select('*')
        .eq('motorista_id', motoristaId)
        .eq('status', 'pronta')
        .maybeSingle();

      if (errorBusca) throw errorBusca;
      
      if (!rotaPronta) {
        Alert.alert("Aviso", "Nenhuma rota pronta encontrada no banco de dados para iniciar.");
        return;
      }

      // 2. Insere na tabela rotas_diarias com status em_andamento
      const { error: errorInsert } = await supabase
        .from('rotas_diarias')
        .insert([{
          motorista_id: motoristaId,
          veiculo_placa: rotaPronta.veiculo_placa,
          lista_entregas: rotaPronta.lista_entregas,
          status: 'em_andamento',
          data_inicio: new Date().toISOString()
        }]);

      if (errorInsert) throw errorInsert;

      // 3. Deleta das rotas_prontas para evitar duplicidade
      await supabase.from('rotas_prontas').delete().eq('id', rotaPronta.id);

      Alert.alert("Sucesso", "Rota iniciada com sucesso!");
      
      // Atualiza o estado visual das entregas com os dados que vieram do banco
      if (rotaPronta.lista_entregas) {
          setEntregas(rotaPronta.lista_entregas);
          await AsyncStorage.setItem('@rota_ativa', JSON.stringify(rotaPronta.lista_entregas));
      }

    } catch (error: any) {
      console.error("Erro ao iniciar rota:", error);
      Alert.alert("Erro ao iniciar", "Falha na comunicação com o banco: " + error.message);
    } finally {
      setCarregando(false);
    }
  };

  // --- FUNÇÃO ADICIONADA: CONFIRMAÇÃO E FINALIZAÇÃO DE ROTA ---
  const handleSairComConfirmacao = () => {
    Alert.alert(
      "Finalizar Expediente",
      "Deseja realmente sair e finalizar sua rota atual no sistema?",
      [
        { text: "Não", style: "cancel" },
        { 
          text: "Sim, Sair", 
          style: "destructive", 
          onPress: async () => {
            setCarregando(true);
            try {
              const sessaoRaw = await AsyncStorage.getItem('@sessao_motorista');
              if (sessaoRaw) {
                const sessao = JSON.parse(sessaoRaw);
                // 1. Finaliza a rota no banco
                if (sessao.id) {
                  await supabase
                    .from('rotas_diarias')
                    .update({ status: 'finalizada' })
                    .eq('motorista_id', sessao.id)
                    .eq('status', 'em_andamento');
                }
                // 2. Libera o veículo
                if (sessao.veiculo) {
                  await supabase
                    .from('veiculos')
                    .update({ motorista_atual_id: null, em_uso: false })
                    .eq('placa', sessao.veiculo);
                }
              }
              // 3. Limpa local e sai
              await AsyncStorage.removeItem('@sessao_motorista');
              await AsyncStorage.removeItem('@rascunho_campos');
              await AsyncStorage.removeItem('@lista_temporaria_backup');
              await AsyncStorage.removeItem('@rota_ativa');
              router.replace('/');
            } catch (error) {
              Alert.alert("Erro", "Falha ao sincronizar saída.");
            } finally {
              setCarregando(false);
            }
          }
        }
      ]
    );
  };

  const encerrarSessao = async () => {
    // Agora chama a função de confirmação com a lógica de banco
    handleSairComConfirmacao();
  };

  useEffect(() => {
    const verificarFilaOffline = async () => {
      try {
        const filaJson = await AsyncStorage.getItem('@fila_sincronizacao_offline');
        if (!filaJson) return;

        const fila = JSON.parse(filaJson);
        if (fila.length === 0) return;

        const { error } = await supabase.from('entregas').upsert(
          fila.map((item: any) => ({
            estabelecimento: item.estabelecimento,
            cnpj: item.cnpj,
            endereco: item.endereco,
            numero: item.numero, // ADICIONADO: Garante que o número suba no offline
            bairro: item.bairro,
            municipio: item.municipio,
            cep: item.cep,
            horario_abre_1: item.horario_abre_1,
            horario_fecha_1: item.horario_fecha_1,
            horario_abre_2: item.horario_abre_2,
            horario_fecha_2: item.horario_fecha_2,
            status: item.status || null,
            motivo_recusa: item.motivo_recusa || null,
            horario_fechamento: item.horario_fechamento || null,
            tempo_permanencia: item.tempo_permanencia || null,
            avaria: item.avaria || false,
            descricao_avaria: item.descricao_avaria || null,
            data_entrega: item.data_entrega || null,
            motorista_id: item.motorista_id || null,
            veiculo_placa: item.veiculo_placa || null,
            created_at: item.created_at || new Date().toISOString()
          })),
          { onConflict: 'cnpj' }
        );

        if (!error) {
          await AsyncStorage.removeItem('@fila_sincronizacao_offline');
        }
      } catch (e) {
        console.log("Sincronizador offline aguardando...");
      }
    };

    const intervalo = setInterval(verificarFilaOffline, 30000); 
    verificarFilaOffline(); 
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const gerenciarRota = async () => {
      try {
        if (params.entregas) {
          const listaValida = JSON.parse(params.entregas as string);
          setEntregas(listaValida);
          await AsyncStorage.setItem('@rota_ativa', params.entregas as string);
        } else {
          const rotaSalva = await AsyncStorage.getItem('@rota_ativa');
          if (rotaSalva) setEntregas(JSON.parse(rotaSalva));
        }
      } catch (e) { console.log("Erro na persistência", e); }
    };
    gerenciarRota();
  }, [params.entregas]);

  useEffect(() => {
    if (entregas.length > 0) {
        AsyncStorage.setItem('@rota_ativa', JSON.stringify(entregas));
    }
  }, [entregas]);

  const aplicarMascaraHora = (valor: string) => {
    const limpo = valor.replace(/\D/g, '');
    return limpo.replace(/^(\d{2})(\d)/, '$1:$2').substring(0, 5);
  };

  const aplicarMascaraCNPJ = (v: string) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
    return v.substring(0, 18);
  };
  
  const aplicarMascaraCep = (v: string) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    return v.substring(0, 9);
  };

  // ADICIONADO E CORRIGIDO: FUNÇÃO PARA BUSCAR O CEP USANDO A BRASILAPI
  const buscarCepAutomaticoModal = async (cepFormatado: string) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      setBuscandoCepModal(true);
      try {
        const resposta = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
        if (!resposta.ok) {
          throw new Error("CEP não encontrado");
        }
        
        const dados = await resposta.json();

        // A Brasil API retorna exatamente a rua, bairro e município corretos no Brasil
        if (dados.street) setNovoEndereco(dados.street);
        setNovoBairro(dados.neighborhood || '');
        setNovoMunicipio(dados.city || '');
        
      } catch (error) {
        console.log("Erro na requisição do CEP", error);
      } finally {
        setBuscandoCepModal(false);
      }
    }
  };

  const handleExcluirDestino = (index: number) => {
    Alert.alert(
      "Excluir Destino",
      "Deseja remover este local da rota?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Remover", 
          style: "destructive", 
          onPress: async () => {
            const novaLista = entregas.filter((_, i) => i !== index);
            setEntregas(novaLista);
            await AsyncStorage.setItem('@rota_ativa', JSON.stringify(novaLista));
          } 
        }
      ]
    );
  };

  // FUNÇÃO PARA MARCAR LOCAL MANUALMENTE - CORRIGIDA PARA IDENTIFICAR CORRETAMENTE O BAIRRO E MUNICÍPIO
  const handleMarcarLocal = async () => {
    setCarregando(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Erro", "Permissão de GPS negada.");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Abre o mapa com a localização exata
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}`,
        android: `geo:0,0?q=${latitude},${longitude}`
      });
      if (url) {
        Linking.openURL(url).catch(err => console.error("Erro ao abrir o GPS", err));
      }

      limparCamposNovoDestino();

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          const local = geocode[0];
          
          setNovoEndereco(local.street || local.name || '');
          setNovoNumero(local.streetNumber || '');
          
          // O SEGREDO ESTÁ AQUI: O GPS da Apple/Google as vezes confunde estado com cidade no Brasil.
          // Como o GPS pega o CEP certo, nós pegamos o CEP e forçamos o sistema a buscar 
          // os dados do endereço oficialmente nos correios através da BrasilAPI.
          if (local.postalCode) {
            const cepFormatado = aplicarMascaraCep(local.postalCode);
            setNovoCep(cepFormatado);
            // Isso vai buscar e preencher automaticamente Bairro (Rio Caveiras) e Municipio (Biguaçu) corretos!
            await buscarCepAutomaticoModal(local.postalCode);
          } else {
             // Fallback caso por algum motivo não venha o CEP do GPS
            setNovoBairro(local.district || local.subregion || '');
            setNovoMunicipio(local.city || local.region || '');
          }

        } else {
          setNovoEndereco(`Coordenadas: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      } catch (geoErro) {
        console.log("Erro ao buscar o nome da rua:", geoErro);
        setNovoEndereco(`Coordenadas: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }

      setModalNovoDestinoVisible(true);

    } catch (e) {
      Alert.alert("Erro", "Não foi possível obter a localização.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const cnpjLimpo = novoCnpj.replace(/\D/g, '');
    if (cnpjLimpo.length === 14) {
      const buscarClienteRapido = async () => {
        setBuscandoNovoCnpj(true);
        try {
          // AJUSTE: O select agora pede a coluna 'numero' para o banco
          const { data } = await supabase.from('entregas').select('estabelecimento, endereco, numero, bairro, municipio, cep, horario_abre_1, horario_fecha_1, horario_abre_2, horario_fecha_2').or(`cnpj.eq.${novoCnpj},cnpj.eq.${cnpjLimpo}`).limit(1).maybeSingle();
          if (data) {
            setNovoNome(data.estabelecimento || '');
            
            // TRAVA: Limpa o endereço caso venha com lixo/CEP do banco
            const enderecoLimpo = data.endereco ? data.endereco.split(' - CEP:')[0] : '';
            setNovoEndereco(enderecoLimpo);

            // ADICIONADO: Preenche o campo Número com o dado que veio do banco
            setNovoNumero(data.numero || '');

            setNovoBairro(data.bairro || '');
            setNovoMunicipio(data.municipio || '');
            setNovoCep(data.cep || '');

            setNovoAbre1(data.horario_abre_1 || '');
            setNovoFecha1(data.horario_fecha_1 || '');
            setNovoAbre2(data.horario_abre_2 || '');
            setNovoFecha2(data.horario_fecha_2 || '');
          }
        } catch (e) {} finally { setBuscandoNovoCnpj(false); }
      };
      buscarClienteRapido();
    }
  }, [novoCnpj]);

  const handleSalvarNovoDestino = async () => {
    if (!novoNome || !novoEndereco) {
      Alert.alert("Atenção", "Preencha o nome e o endereço.");
      return;
    }
    setCarregando(true);

    const sessaoRaw = await AsyncStorage.getItem('@sessao_motorista');
    const sessao = sessaoRaw ? JSON.parse(sessaoRaw) : null;

    // Concatena o endereço para salvar na visualização da lista (mantendo compatibilidade)
    let enderecoCompletoFormatado = novoEndereco;
    if (novoNumero) enderecoCompletoFormatado += `, ${novoNumero}`;
    if (novoBairro || novoMunicipio) {
        enderecoCompletoFormatado += ` - ${novoBairro} ${novoMunicipio}`;
    }
    if (novoCep) enderecoCompletoFormatado += ` - CEP: ${novoCep}`;

    const dadosNovo = { 
      estabelecimento: novoNome, 
      cnpj: novoCnpj, 
      endereco: enderecoCompletoFormatado, // Salva concatenado para a lista
      numero: novoNumero, // ADICIONADO: Salva o número separado no banco
      bairro: novoBairro,
      municipio: novoMunicipio,
      cep: novoCep,
      horario_abre_1: novoAbre1,
      horario_fecha_1: novoFecha1,
      horario_abre_2: novoAbre2,
      horario_fecha_2: novoFecha2,
      motorista_id: sessao?.id || null, 
      veiculo_placa: sessao?.veiculo || null,
      created_at: new Date().toISOString()
    };

    try {
      const { data: novoSalvo, error } = await supabase.from('entregas').upsert([dadosNovo], { onConflict: 'cnpj' }).select().single();
      if (error) throw error;
      const dadosParaLista = { ...novoSalvo, concluido: false };
      
      const novaLista = [...entregas, dadosParaLista];
      setEntregas(novaLista);
      await AsyncStorage.setItem('@rota_ativa', JSON.stringify(novaLista));

      // Sincroniza com a rota em andamento do Supabase
      if (sessao && sessao.id) {
        await supabase
          .from('rotas_diarias')
          .update({ lista_entregas: novaLista })
          .eq('motorista_id', sessao.id)
          .eq('status', 'em_andamento');
      }

      setModalNovoDestinoVisible(false);
      limparCamposNovoDestino();
    } catch (e: any) { 
      const novoOffline = { ...dadosNovo, concluido: false };
      
      const novaListaOffline = [...entregas, novoOffline];
      setEntregas(novaListaOffline);
      await AsyncStorage.setItem('@rota_ativa', JSON.stringify(novaListaOffline));

      const filaAtual = await AsyncStorage.getItem('@fila_sincronizacao_offline');
      const fila = filaAtual ? JSON.parse(filaAtual) : [];
      await AsyncStorage.setItem('@fila_sincronizacao_offline', JSON.stringify([...fila, dadosNovo]));
      
      setModalNovoDestinoVisible(false);
      limparCamposNovoDestino();
    } finally { setCarregando(false); }
  };

  const limparCamposNovoDestino = () => {
    setNovoNome(''); 
    setNovoCnpj(''); 
    setNovoEndereco('');
    setNovoNumero('');
    setNovoBairro('');
    setNovoMunicipio('');
    setNovoCep('');
    setNovoAbre1(''); setNovoFecha1(''); setNovoAbre2(''); setNovoFecha2('');
  };

  const handleFinalizarRotaGeral = () => {
    const totalSucessos = entregas.filter(e => e.status === 'Entrega com Sucesso').length;
    const totalPendencias = entregas.length - totalSucessos;

    Alert.alert(
      "Finalizar Expediente",
      `Resumo das Entregas:\n\n✅ Sucessos: ${totalSucessos}\n⚠️ Outros Status: ${totalPendencias}\n\nDeseja encerrar e liberar o veículo?`,
      [
        { text: "Continuar na Rota", style: "cancel" },
        { 
          text: "Confirmar e Sair", 
          onPress: async () => {
            // Usa a função de encerramento global com banco de dados
            handleSairComConfirmacao();
          } 
        }
      ]
    );
  };

  const formatarHora = (data: Date) => data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const finalizarEntregaNoBanco = async () => {
    if (!statusSelecionado) {
      Alert.alert("Atenção", "Selecione o que aconteceu na entrega.");
      return;
    }
    
    if (statusSelecionado === 'Recusou Receber' && !motivoRecusa) {
      Alert.alert("Atenção", "Informe o motivo da recusa.");
      return;
    }

    if (!itemAtual) {
      Alert.alert("Erro", "Nenhum item selecionado para salvar.");
      return;
    }

    setCarregando(true);

    const dataAtual = new Date();
    const horaFinalVoltar = statusSelecionado === 'Voltar Mais Tarde' ? formatarHora(horarioData) : null;
    const tempoPermanencia = formatarCronometro(segundosAtendimento);
    const estaConcluido = statusSelecionado !== 'Voltar Mais Tarde';

    const novasEntregas = entregas.map((entrega) => {
      if (itemAtual && entrega.cnpj === itemAtual.cnpj) {
        return { 
          ...entrega, 
          status: statusSelecionado, 
          concluido: estaConcluido, 
          statusExibicao: statusSelecionado === 'Voltar Mais Tarde' ? `Voltar em breve (Até: ${horaFinalVoltar})` : statusSelecionado,
          tempo_permanencia: tempoPermanencia,
          avaria: temAvaria,
          descricao_avaria: temAvaria ? descricaoAvaria : null,
          data_entrega: dataAtual.toISOString()
        };
      }
      return entrega;
    });

    try {
      const sessaoRaw = await AsyncStorage.getItem('@sessao_motorista');
      const sessao = sessaoRaw ? JSON.parse(sessaoRaw) : null;

      const { error: errorIndividual } = await supabase.from('entregas').update({ 
          status: statusSelecionado,
          motivo_recusa: statusSelecionado === 'Recusou Receber' ? motivoRecusa : null,
          horario_fechamento: horaFinalVoltar,
          tempo_permanencia: tempoPermanencia,
          avaria: temAvaria,
          descricao_avaria: temAvaria ? descricaoAvaria : null,
          data_entrega: dataAtual.toISOString(), 
          motorista_id: sessao?.id || null, 
          veiculo_placa: sessao?.veiculo || null
      })
      .eq('cnpj', itemAtual.cnpj);

      if (errorIndividual) throw errorIndividual;

      if (sessao && sessao.id) {
        const { error: errorRota } = await supabase
          .from('rotas_diarias')
          .update({ lista_entregas: novasEntregas })
          .eq('motorista_id', sessao.id)
          .eq('status', 'em_andamento');
        
        if (errorRota) throw errorRota;
      }

      setEntregas(novasEntregas);
      setAtendimentoIniciado(false); 
      setSegundosAtendimento(0);
      fecharModalStatus();
    } catch (error: any) {
      console.error("Erro ao salvar no banco:", error.message);
      Alert.alert("Aviso", "Houve um problema com a sincronização, mas os dados foram salvos localmente.");
      setEntregas(novasEntregas);
      setAtendimentoIniciado(false);
      setSegundosAtendimento(0);
      fecharModalStatus();
    } finally { setCarregando(false); }
  };

  const fecharModalStatus = () => {
    setModalVisible(false);
    setEditandoHorarioNoStatus(false);
    setMotivoRecusa('');
    setStatusSelecionado('');
    setTemAvaria(false);
    setDescricaoAvaria('');
  };

  const iniciarGps = (item: any) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(item.endereco)}`,
      android: `geo:0,0?q=${encodeURIComponent(item.endereco)}`
    });
    Linking.openURL(url!).then(() => {
      setTimeout(() => {
        Alert.alert("Chegada", `Chegou em: ${item.estabelecimento}?`, [
          { text: "Não", style: "destructive" },
          { text: "Sim", onPress: () => { 
            setItemAtual(item); 
            setHoraChegada(new Date()); 
            setNovoAbre1(item.horario_abre_1 || '');
            setNovoFecha1(item.horario_fecha_1 || '');
            setNovoAbre2(item.horario_abre_2 || '');
            setNovoFecha2(item.horario_fecha_2 || '');
            setAtendimentoIniciado(true);
            setModalVisible(true); 
          } }
        ]);
      }, 2000);
    });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.safeAreaWrapper}>
        <StatusBar barStyle="light-content" backgroundColor="#0033ff" translucent={false} />
        
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rota de Entregas</Text>
            {/* Botão de Sair no Header com confirmação e limpeza de banco */}
            <TouchableOpacity onPress={handleSairComConfirmacao} style={styles.btnSairTopo}>
              <Ionicons name="log-out-outline" size={26} color="#FFF" />
              <Text style={styles.txtSairTopo}>Sair</Text>
            </TouchableOpacity>
          </View>

          {atendimentoIniciado && itemAtual && (
            <View style={styles.timerWidget}>
              <View>
                <Text style={styles.timerWidgetLocal}>Atendimento: {itemAtual.estabelecimento}</Text>
                <Text style={styles.timerWidgetTempo}>Tempo: {formatarCronometro(segundosAtendimento)}</Text>
              </View>
              <Ionicons name="timer" size={24} color="#FFF" />
            </View>
          )}

          <View style={styles.instrucaoBar}>
            <Text style={styles.subTitulo}></Text>
            <View style={{flexDirection: 'row', gap: 8}}>
              {/* BOTÃO INICIAR COM PROTEÇÃO DE SESSÃO E LÓGICA DE TABELAS */}
              <TouchableOpacity 
                style={[styles.btnNovaRota, {borderColor: '#ff8c00'}]} 
                onPress={handleIniciarRotaBanco}
                disabled={carregando}
              >
                  {carregando ? <ActivityIndicator size="small" color="#ff8c00" /> : (
                    <>
                      <Ionicons name="play" size={20} color="#ff8c00" />
                      <Text style={[styles.txtNovaRota, {color: '#ff8c00'}]}>INICIAR</Text>
                    </>
                  )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnNovaRota, {borderColor: '#28a745'}]} onPress={handleMarcarLocal} disabled={carregando}>
                  <Ionicons name="pin" size={20} color="#28a745" />
                  <Text style={[styles.txtNovaRota, {color: '#28a745'}]}>MARCAR LOCAL</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnNovaRota} onPress={() => {
                limparCamposNovoDestino();
                setModalNovoDestinoVisible(true);
              }}>
                  <Ionicons name="add-circle" size={20} color="#0033ff" />
                  <Text style={styles.txtNovaRota}>NOVA ROTA</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CÓDIGO ORIGINAL - MANTIDO INTACTO MAS COMENTADO PARA DAR LUGAR À NOVA LISTA (REGRA DE NÃO DELETAR)
          <ScrollView contentContainerStyle={styles.content}>
            {entregas.map((item: any, index: number) => {
              const isSucesso = item.status === 'Entrega com Sucesso';
              const isRecusado = item.status === 'Recusou Receber' || item.status === 'Pedido não realizado';
              
              return (
                <View key={index} style={[
                  styles.card, 
                  (item.concluido && item.status !== 'Voltar Mais Tarde') && styles.cardConcluido,
                  isSucesso && styles.cardSucesso,
                  isRecusado && styles.cardRecusado
                ]}>
                  <View style={styles.info}>
                    <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                      <Text style={styles.nome}>{index + 1}. {item.estabelecimento}</Text>
                      {(item.horario_abre_1 || item.horario_fecha_1) && (
                        <Text style={styles.horarioLinhaNome}> ({item.horario_abre_1} - {item.horario_fecha_1})</Text>
                      )}
                    </View>
                    <Text style={styles.cnpjTexto}>CNPJ: {item.cnpj || "Não informado"}</Text>
                    <Text style={styles.endereco}>{item.endereco}</Text>
                    
                    <View style={styles.detalhesEntrega}>
                      {item.tempo_permanencia && (
                        <Text style={styles.txtDetalhe}><Ionicons name="timer-outline" /> {item.tempo_permanencia}</Text>
                      )}
                      {item.avaria && (
                        <Text style={[styles.txtDetalhe, {color: 'red'}]}><Ionicons name="warning-outline" /> Com Avaria</Text>
                      )}
                    </View>

                    {item.horario_abre_2 && (
                      <View style={styles.horarioContainer}>
                        <Ionicons name="time-outline" size={14} color="#0033ff" />
                        <Text style={styles.horarioTexto}>2º Turno: {item.horario_abre_2}-{item.horario_fecha_2}</Text>
                      </View>
                    )}
                    {item.statusExibicao && (
                      <Text style={[styles.statusBadge, isSucesso && styles.statusBadgeSucesso, isRecusado && {color: '#d32f2f'}]}>
                        {item.statusExibicao}
                      </Text>
                    )}
                  </View>

                  <View style={styles.actionsContainer}>
                    {item.concluido && item.status !== 'Voltar Mais Tarde' ? (
                      <View style={styles.checkIconContainer}>
                        <Ionicons 
                          name={isSucesso ? "checkmark-circle" : "close-circle"} 
                          size={32} 
                          color={isSucesso ? "#28a745" : "#d32f2f"} 
                        />
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity style={styles.btnExcluirItem} onPress={() => handleExcluirDestino(index)}>
                          <Ionicons name="trash" size={24} color="#FF0000" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnGps} onPress={() => iniciarGps(item)}>
                          <Ionicons name="location" size={28} color="#FFF" />
                          <Text style={styles.btnText}>GPS</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}

            {todasFinalizadas && (
              <TouchableOpacity style={styles.btnFinalizarRotaGeral} onPress={handleFinalizarRotaGeral} disabled={carregando}>
                {carregando ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="log-out" size={24} color="#FFF" />
                    <Text style={styles.txtFinalizarRotaGeral}>FINALIZAR ROTA DE HOJE</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
          */}

          {/* INÍCIO DA NOVA LISTA ARRASTÁVEL */}
          <DraggableFlatList
            data={entregas}
            onDragEnd={async ({ data }) => {
              setEntregas(data);
              await AsyncStorage.setItem('@rota_ativa', JSON.stringify(data));
              
              // Atualiza a ordem no banco de dados se a rota já estiver em andamento
              const sessaoRaw = await AsyncStorage.getItem('@sessao_motorista');
              if (sessaoRaw) {
                const sessao = JSON.parse(sessaoRaw);
                if (sessao.id) {
                  await supabase
                    .from('rotas_diarias')
                    .update({ lista_entregas: data })
                    .eq('motorista_id', sessao.id)
                    .eq('status', 'em_andamento');
                }
              }
            }}
            keyExtractor={(item, index) => item.cnpj ? item.cnpj + index : index.toString()}
            contentContainerStyle={styles.content}
            renderItem={({ item, drag, isActive, getIndex }) => {
              const index = getIndex() || 0;
              const isSucesso = item.status === 'Entrega com Sucesso';
              const isRecusado = item.status === 'Recusou Receber' || item.status === 'Pedido não realizado';
              
              return (
                <ScaleDecorator>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={drag}
                    delayLongPress={2000} // Exigência de segurar por 2 segundos
                    disabled={isActive}
                    style={[
                      styles.card, 
                      (item.concluido && item.status !== 'Voltar Mais Tarde') && styles.cardConcluido,
                      isSucesso && styles.cardSucesso,
                      isRecusado && styles.cardRecusado,
                      isActive && { backgroundColor: '#e6f0ff', transform: [{ scale: 1.02 }], shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, elevation: 10, zIndex: 999 }
                    ]}
                  >
                    <View style={styles.info}>
                      <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'}}>
                        <Text style={styles.nome}>{index + 1}. {item.estabelecimento}</Text>
                        {(item.horario_abre_1 || item.horario_fecha_1) && (
                          <Text style={styles.horarioLinhaNome}> ({item.horario_abre_1} - {item.horario_fecha_1})</Text>
                        )}
                      </View>
                      <Text style={styles.cnpjTexto}>CNPJ: {item.cnpj || "Não informado"}</Text>
                      <Text style={styles.endereco}>{item.endereco}</Text>
                      
                      <View style={styles.detalhesEntrega}>
                        {item.tempo_permanencia && (
                          <Text style={styles.txtDetalhe}><Ionicons name="timer-outline" /> {item.tempo_permanencia}</Text>
                        )}
                        {item.avaria && (
                          <Text style={[styles.txtDetalhe, {color: 'red'}]}><Ionicons name="warning-outline" /> Com Avaria</Text>
                        )}
                      </View>

                      {item.horario_abre_2 && (
                        <View style={styles.horarioContainer}>
                          <Ionicons name="time-outline" size={14} color="#0033ff" />
                          <Text style={styles.horarioTexto}>2º Turno: {item.horario_abre_2}-{item.horario_fecha_2}</Text>
                        </View>
                      )}
                      {item.statusExibicao && (
                        <Text style={[styles.statusBadge, isSucesso && styles.statusBadgeSucesso, isRecusado && {color: '#d32f2f'}]}>
                          {item.statusExibicao}
                        </Text>
                      )}
                    </View>

                    <View style={styles.actionsContainer}>
                      {item.concluido && item.status !== 'Voltar Mais Tarde' ? (
                        <View style={styles.checkIconContainer}>
                          <Ionicons 
                            name={isSucesso ? "checkmark-circle" : "close-circle"} 
                            size={32} 
                            color={isSucesso ? "#28a745" : "#d32f2f"} 
                          />
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity style={styles.btnExcluirItem} onPress={() => handleExcluirDestino(index)}>
                            <Ionicons name="trash" size={24} color="#FF0000" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.btnGps} onPress={() => iniciarGps(item)}>
                            <Ionicons name="location" size={28} color="#FFF" />
                            <Text style={styles.btnText}>GPS</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </ScaleDecorator>
              );
            }}
            ListFooterComponent={() => 
              todasFinalizadas ? (
                <TouchableOpacity style={styles.btnFinalizarRotaGeral} onPress={handleFinalizarRotaGeral} disabled={carregando}>
                  {carregando ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Ionicons name="log-out" size={24} color="#FFF" />
                      <Text style={styles.txtFinalizarRotaGeral}>FINALIZAR ROTA DE HOJE</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null
            }
          />
          {/* FIM DA NOVA LISTA ARRASTÁVEL */}

          <Modal visible={modalNovoDestinoVisible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Novo Destino na Rota</Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                  
                  <Text style={styles.labelInputSmall}>Nome do Estabelecimento</Text>
                  <TextInput style={styles.inputModalNew} placeholder="Ex: Mercado Silva" value={novoNome} onChangeText={setNovoNome} />
                  
                  <Text style={styles.labelInputSmall}>CNPJ do Cliente</Text>
                  <View style={styles.inputRow}>
                      <TextInput style={[styles.inputModalNew, {flex: 1, marginTop: 0}]} placeholder="00.000.000/0001-00" value={novoCnpj} onChangeText={(t) => setNovoCnpj(aplicarMascaraCNPJ(t))} keyboardType="numeric" />
                      {buscandoNovoCnpj && <ActivityIndicator color="#0033ff" style={{marginLeft: 10}} />}
                  </View>
                  
                  <View style={styles.rowForm}>
                      <View style={{flex: 2, marginRight: 10}}>
                          <Text style={styles.labelInputSmall}>Endereço de Entrega</Text>
                          <TextInput style={styles.inputModalNew} placeholder="Rua / Av" value={novoEndereco} onChangeText={setNovoEndereco} />
                      </View>
                      <View style={{flex: 1}}>
                          <Text style={styles.labelInputSmall}>Número</Text>
                          <TextInput style={styles.inputModalNew} placeholder="Ex: 10" value={novoNumero} onChangeText={setNovoNumero} keyboardType="numeric" />
                      </View>
                  </View>

                  <View style={styles.rowForm}>
                      <View style={{flex: 1, marginRight: 10}}>
                          <Text style={styles.labelInputSmall}>Bairro</Text>
                          <TextInput style={styles.inputModalNew} placeholder="Bairro" value={novoBairro} onChangeText={setNovoBairro} />
                      </View>
                      <View style={{flex: 1}}>
                          <Text style={styles.labelInputSmall}>Município</Text>
                          <TextInput style={styles.inputModalNew} placeholder="Cidade" value={novoMunicipio} onChangeText={setNovoMunicipio} />
                      </View>
                  </View>

                  <Text style={styles.labelInputSmall}>CEP</Text>
                  <View style={styles.inputRow}>
                      <TextInput 
                        style={[styles.inputModalNew, { flex: 1, marginTop: 0 }]} 
                        placeholder="00000-000" 
                        value={novoCep} 
                        onChangeText={(t) => {
                          const formatado = aplicarMascaraCep(t);
                          setNovoCep(formatado);
                          buscarCepAutomaticoModal(formatado);
                        }} 
                        keyboardType="numeric"
                        maxLength={9}
                      />
                      {buscandoCepModal && <ActivityIndicator color="#0033ff" style={{marginLeft: 10}} />}
                  </View>

                  <Text style={styles.labelModal}>Horários de Atendimento</Text>
                  <View style={styles.innerRow}>
                    <TextInput style={styles.inputHora} placeholder="07:00" value={novoAbre1} onChangeText={(t) => setNovoAbre1(aplicarMascaraHora(t))} keyboardType="numeric" />
                    <TextInput style={styles.inputHora} placeholder="12:00" value={novoFecha1} onChangeText={(t) => setNovoFecha1(aplicarMascaraHora(t))} keyboardType="numeric" />
                  </View>
                  <View style={[styles.innerRow, {marginTop: 10}]}>
                    <TextInput style={styles.inputHora} placeholder="14:00" value={novoAbre2} onChangeText={(t) => setNovoAbre2(aplicarMascaraHora(t))} keyboardType="numeric" />
                    <TextInput style={styles.inputHora} placeholder="21:00" value={novoFecha2} onChangeText={(t) => setNovoFecha2(aplicarMascaraHora(t))} keyboardType="numeric" />
                  </View>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalNovoDestinoVisible(false)}><Text style={styles.txtBtn}>VOLTAR</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvarNovoDestino} disabled={carregando}>
                      {carregando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.txtBtnBranco}>ADICIONAR</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContentStatus}>
                <View style={styles.modalTimerHeader}>
                  <Text style={styles.modalTimerLabel}>TEMPO DE ATENDIMENTO</Text>
                  <Text style={styles.modalTimerValue}>{formatarCronometro(segundosAtendimento)}</Text>
                </View>

                <Text style={styles.modalTitle}>{editandoHorarioNoStatus ? "Ajustar Horário" : "O que aconteceu?"}</Text>
                {!editandoHorarioNoStatus ? (
                  <>
                    <ScrollView style={{maxHeight: 250}}>
                      <View style={styles.opcoesContainer}>
                        {['Entrega com Sucesso', 'Cliente Fechado', 'Recusou Receber', 'Voltar Mais Tarde', 'Pedido não realizado'].map((s) => (
                          <TouchableOpacity key={s} style={[styles.btnOpcao, statusSelecionado === s && styles.btnOpcaoAtivo]} onPress={() => setStatusSelecionado(s)}>
                            <Text style={[styles.txtOpcao, statusSelecionado === s && styles.txtOpcaoAtivo]}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    <View style={styles.avariaContainer}>
                      <View style={styles.rowAvaria}>
                        <Text style={styles.labelAvaria}>Houve avaria no produto?</Text>
                        <Switch value={temAvaria} onValueChange={setTemAvaria} trackColor={{ false: "#767577", true: "#ff8c00" }} />
                      </View>
                      {temAvaria && (
                        <TextInput 
                          style={styles.inputAvaria} 
                          placeholder="Descreva a avaria..." 
                          value={descricaoAvaria} 
                          onChangeText={setDescricaoAvaria} 
                        />
                      )}
                    </View>

                    <TouchableOpacity style={styles.btnAjustarHorarioStatus} onPress={() => setEditandoHorarioNoStatus(true)}>
                      <Text style={styles.txtAjustarHorarioStatus}>AJUSTAR HORÁRIO CLIENTE</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{paddingVertical: 10}}>
                      <View style={styles.innerRow}>
                        <TextInput style={styles.inputHora} value={novoAbre1} onChangeText={(t) => setNovoAbre1(aplicarMascaraHora(t))} keyboardType="numeric" />
                        <TextInput style={styles.inputHora} value={novoFecha1} onChangeText={(t) => setNovoFecha1(aplicarMascaraHora(t))} keyboardType="numeric" />
                      </View>
                      <View style={[styles.innerRow, {marginTop: 10}]}>
                        <TextInput style={styles.inputHora} value={novoAbre2} onChangeText={(t) => setNovoAbre2(aplicarMascaraHora(t))} keyboardType="numeric" />
                        <TextInput style={styles.inputHora} value={novoFecha2} onChangeText={(t) => setNovoFecha2(aplicarMascaraHora(t))} keyboardType="numeric" />
                      </View>
                      <TouchableOpacity style={{marginTop: 20, alignItems: 'center'}} onPress={() => setEditandoHorarioNoStatus(false)}>
                        <Text style={{color: '#0033ff', fontWeight: 'bold'}}>CONFIRMAR E VOLTAR</Text>
                      </TouchableOpacity>
                  </View>
                )}
                {statusSelecionado === 'Voltar Mais Tarde' && <TouchableOpacity style={styles.btnRelogio} onPress={() => setMostrarRelogio(true)}><Text style={styles.txtRelogio}>{formatarHora(horarioData)}</Text></TouchableOpacity>}
                {mostrarRelogio && <DateTimePicker value={horarioData} mode="time" is24Hour={true} onChange={(e, d) => {setMostrarRelogio(false); if(d) setHorarioData(d);}} />}
                {statusSelecionado === 'Recusou Receber' && <TextInput style={styles.inputModal} placeholder="Motivo..." onChangeText={setMotivoRecusa} />}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnCancelar} onPress={fecharModalStatus}><Text style={styles.txtBtn}>SAIR</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnSalvar} onPress={finalizarEntregaNoBanco}><Text style={styles.txtBtnBranco}>SALVAR</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeAreaWrapper: { flex: 1, backgroundColor: 'white' },
  container: { flex: 1, backgroundColor: '#F4F7F6' },
  header: { 
    backgroundColor: '#0033ff', 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 20 
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  btnSairTopo: {
    position: 'absolute',
    right: 15,
    alignItems: 'center'
  },
  txtSairTopo: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -2
  },
  timerWidget: { backgroundColor: '#28a745', flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'space-between' },
  timerWidgetLocal: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  timerWidgetTempo: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  instrucaoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 15 },
  subTitulo: { fontSize: 15, color: '#666', fontWeight: '500' },
  btnNovaRota: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#0033ff' },
  txtNovaRota: { color: '#0033ff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  content: { padding: 20, paddingBottom: 120 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  cardConcluido: { backgroundColor: '#f5f5f5', opacity: 0.9 },
  cardSucesso: { backgroundColor: '#e8f5e9', borderColor: '#28a745', borderWidth: 1 },
  cardRecusado: { backgroundColor: '#ffebee', borderColor: '#d32f2f', borderWidth: 1 },
  info: { flex: 1 },
  nome: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  horarioLinhaNome: { fontSize: 14, color: '#0033ff', fontWeight: 'bold' }, 
  cnpjTexto: { fontSize: 11, color: '#777', marginBottom: 2 }, 
  endereco: { fontSize: 13, color: '#666' },
  detalhesEntrega: { flexDirection: 'row', marginTop: 5, gap: 10 },
  txtDetalhe: { fontSize: 11, color: '#555', fontWeight: '500' },
  horarioContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: '#f0f4ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  horarioTexto: { fontSize: 11, color: '#0033ff', marginLeft: 5 },
  statusBadge: { color: '#FF0000', fontWeight: 'bold', fontSize: 12, marginTop: 5 },
  statusBadgeSucesso: { color: '#28a745' },
  actionsContainer: { flexDirection: 'row', alignItems: 'center' },
  btnExcluirItem: { marginRight: 15, padding: 5 },
  btnGps: { backgroundColor: '#28a745', padding: 10, borderRadius: 10, alignItems: 'center', width: 70 },
  btnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  checkIconContainer: { width: 70, alignItems: 'center' },
  btnFinalizarRotaGeral: { backgroundColor: '#ff8c00', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 12, marginTop: 20, marginBottom: 40 },
  txtFinalizarRotaGeral: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '95%', borderRadius: 20, padding: 20 },
  modalContentStatus: { backgroundColor: '#FFF', width: '90%', borderRadius: 20, padding: 20 },
  modalTimerHeader: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15, borderBottomWidth: 2, borderBottomColor: '#28a745' },
  modalTimerLabel: { fontSize: 10, fontWeight: 'bold', color: '#666' },
  modalTimerValue: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  rowForm: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  labelInputSmall: { fontSize: 11, fontWeight: 'bold', color: '#555', marginTop: 10, marginBottom: 2 },
  inputModalNew: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 10, fontSize: 13, width: '100%' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputModal: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, marginTop: 10 },
  labelModal: { fontSize: 14, fontWeight: 'bold', color: '#444', marginTop: 20 },
  innerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputHora: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 10, width: '48%', textAlign: 'center' },
  opcoesContainer: { marginBottom: 10 },
  btnOpcao: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#EEE', marginBottom: 8 },
  btnOpcaoAtivo: { backgroundColor: '#E6F0FF', borderColor: '#0033ff' },
  txtOpcao: { textAlign: 'center' },
  txtOpcaoAtivo: { color: '#0033ff', fontWeight: 'bold' },
  avariaContainer: { borderTopWidth: 1, borderColor: '#EEE', marginTop: 10, paddingTop: 10 },
  rowAvaria: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelAvaria: { fontSize: 13, color: '#444', fontWeight: 'bold' },
  inputAvaria: { backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#FFCCCC', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  btnCancelar: { flex: 1, padding: 15, alignItems: 'center' },
  btnSalvar: { flex: 1, backgroundColor: '#0033ff', padding: 15, borderRadius: 10, alignItems: 'center' },
  txtBtn: { fontWeight: 'bold', color: '#666' },
  txtBtnBranco: { fontWeight: 'bold', color: '#FFF' },
  btnAjustarHorarioStatus: { padding: 10, marginTop: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ff8c00', borderRadius: 8, alignItems: 'center' },
  txtAjustarHorarioStatus: { color: '#ff8c00', fontSize: 11, fontWeight: 'bold' }
});