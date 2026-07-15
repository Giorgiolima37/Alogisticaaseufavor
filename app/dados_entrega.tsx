import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import Voice from '@react-native-voice/voice';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from './supabase';

export default function DadosEntregaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  
  const [estabelecimento, setEstabelecimento] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState(''); 
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [estado, setEstado] = useState(''); // NOVO: Campo de Estado (UF)
  const [cep, setCep] = useState('');

  const [horarioAbre, setHorarioAbre] = useState('');
  const [horarioFecha, setHorarioFecha] = useState('');
  const [horarioAbre2, setHorarioAbre2] = useState('');
  const [horarioFecha2, setHorarioFecha2] = useState('');
  
  const [dadosSessao, setDadosSessao] = useState<{id: string, nome: string, veiculo: string, rota_id?: string} | null>(null);
  const [listaEntregas, setListaEntregas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [ouvindoEndereco, setOuvindoEndereco] = useState(false);

  const corrigirTextoFalado = (texto: string) => {
    return texto
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (letra) => letra.toUpperCase());
  };

  const ouvirEndereco = async () => {
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Microfone',
        'O reconhecimento de voz não funciona no Expo Go. Para falar o endereço, instale o app gerado pelo comando npx expo run:android ou por uma build do EAS.'
      );
      return;
    }

    try {
      const disponivel = await Voice.isAvailable();

      if (!disponivel) {
        Alert.alert('Microfone', 'Reconhecimento de voz não disponível neste aparelho.');
        return;
      }

      setOuvindoEndereco(true);
      await Voice.stop();
      await Voice.start('pt-BR');
    } catch (error) {
      console.log('Erro ao iniciar reconhecimento de voz', error);
      setOuvindoEndereco(false);
      Alert.alert('Microfone', 'Não foi possível iniciar o reconhecimento de voz. Verifique a permissão do microfone e use a build nativa do app.');
    }
  };
  const aplicarMascaraCEP = (valor: string) => {
    const limpo = valor.replace(/\D/g, ''); 
    return limpo
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 9);
  };

  const buscarCepAutomatico = async (cepFormatado: string) => {
    const cepLimpo = cepFormatado.replace(/\D/g, '');
    
    if (cepLimpo.length === 8) {
      setBuscandoCep(true);
      try {
        const resposta = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
        
        if (!resposta.ok) {
          throw new Error("CEP nï¿½o encontrado");
        }
        
        const dados = await resposta.json();

        setEndereco(dados.street || '');
        setBairro(dados.neighborhood || '');
        setMunicipio(dados.city || '');
        setEstado(dados.state || ''); // Preenche o estado automaticamente tambï¿½m
        
      } catch (error) {
        console.log("Erro na requisiï¿½ï¿½o do CEP", error);
        Alert.alert("Aviso", "Nï¿½o foi possï¿½vel encontrar este CEP automaticamente. Por favor, preencha o endereï¿½o manualmente.");
      } finally {
        setBuscandoCep(false); 
      }
    }
  };

  // NOVO: Funï¿½ï¿½o para buscar o CEP baseado no Endereï¿½o, Municï¿½pio e Estado
  const buscarCepPeloEndereco = async () => {
    if (!estado || !municipio || !endereco) {
      Alert.alert("Atenï¿½ï¿½o", "Preencha o Endereï¿½o (Rua), Municï¿½pio e UF para buscar o CEP.");
      return;
    }
    if (estado.length !== 2) {
      Alert.alert("Atenï¿½ï¿½o", "O Estado (UF) deve conter 2 letras (ex: SC, SP).");
      return;
    }

    setBuscandoCep(true);
    try {
      // A API ViaCEP faz a busca reversa usando: viacep.com.br/ws/UF/Cidade/Rua/json/
      const url = `https://viacep.com.br/ws/${estado}/${encodeURIComponent(municipio)}/${encodeURIComponent(endereco)}/json/`;
      const resposta = await fetch(url);
      const dados = await resposta.json();

      if (dados && dados.length > 0) {
        // Pega o primeiro resultado retornado
        const cepEncontrado = dados[0].cep;
        setCep(aplicarMascaraCEP(cepEncontrado));
        
        // Se o bairro estava vazio, aproveita para preencher
        if (dados[0].bairro && !bairro) setBairro(dados[0].bairro);
      } else {
        Alert.alert("Aviso", "Nï¿½o foi possï¿½vel encontrar um CEP exato para este endereï¿½o. Verifique se os dados estï¿½o corretos.");
      }
    } catch (error) {
      console.log("Erro na requisiï¿½ï¿½o reversa do CEP", error);
      Alert.alert("Erro", "Falha ao buscar o CEP. Tente novamente.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const encerrarSessao = async () => {
    Alert.alert(
      "Sair do Sistema",
      "Deseja realmente encerrar sua jornada e liberar o veï¿½culo?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive", 
          onPress: async () => {
            setCarregando(true);
            try {
              if (dadosSessao?.veiculo) {
                await supabase
                  .from('veiculos')
                  .update({ 
                    motorista_atual_id: null, 
                    em_uso: false 
                  })
                  .eq('placa', dadosSessao.veiculo);
                
                if (dadosSessao.id) {
                    await supabase
                      .from('rotas_diarias')
                      .update({ status: 'finalizada' })
                      .eq('motorista_id', dadosSessao.id)
                      .eq('status', 'em_andamento');
                }
              }

              await AsyncStorage.removeItem('@sessao_motorista');
              await AsyncStorage.removeItem('@rascunho_campos');
              await AsyncStorage.removeItem('@lista_temporaria_backup');
              
              router.replace('/');
            } catch (error) {
              Alert.alert("Erro", "Nï¿½o foi possï¿½vel liberar o veï¿½culo.");
            } finally {
              setCarregando(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    Voice.onSpeechResults = (event) => {
      const textoFalado = event.value?.[0];
      if (textoFalado) {
        setEndereco(corrigirTextoFalado(textoFalado));
      }
    };

    Voice.onSpeechEnd = () => setOuvindoEndereco(false);
    Voice.onSpeechError = () => setOuvindoEndereco(false);

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);
  useEffect(() => {
    const restaurarDadosPersistentes = async () => {
      try {
        const sessaoStr = await AsyncStorage.getItem('@sessao_motorista');
        if (!sessaoStr) return;
        
        const sessao = JSON.parse(sessaoStr);
        setDadosSessao(sessao);

        const { data: rotaAtiva } = await supabase
          .from('rotas_diarias')
          .select('lista_entregas')
          .eq('motorista_id', sessao.id)
          .eq('status', 'em_andamento')
          .maybeSingle();

        if (rotaAtiva?.lista_entregas && Array.isArray(rotaAtiva.lista_entregas)) {
          setListaEntregas(rotaAtiva.lista_entregas);
        } else {
          const listaSalva = await AsyncStorage.getItem('@lista_temporaria_backup');
          if (listaSalva) {
            setListaEntregas(JSON.parse(listaSalva));
          }
        }

        const rascunho = await AsyncStorage.getItem('@rascunho_campos');
        if (rascunho) {
          const d = JSON.parse(rascunho);
          setEstabelecimento(d.estabelecimento || '');
          setCnpj(d.cnpj || '');
          setEndereco(d.endereco || '');
          setNumero(d.numero || ''); 
          setBairro(d.bairro || '');
          setMunicipio(d.municipio || '');
          setEstado(d.estado || ''); // Restaura o estado do rascunho
          setCep(d.cep || '');
          setHorarioAbre(d.horarioAbre || '');
          setHorarioFecha(d.horarioFecha || '');
          setHorarioAbre2(d.horarioAbre2 || '');
          setHorarioFecha2(d.horarioFecha2 || '');
        }

      } catch (e) { console.log("Erro ao restaurar dados", e); }
    };

    navigation.setOptions({ headerShown: false, gestureEnabled: false });
    const backAction = () => {
      Alert.alert("Atenï¿½ï¿½o", "Finalize sua rota ou saia pelo menu de encerramento.");
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    
    restaurarDadosPersistentes();
    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    const salvarRascunho = async () => {
      const dados = { estabelecimento, cnpj, endereco, numero, bairro, municipio, estado, cep, horarioAbre, horarioFecha, horarioAbre2, horarioFecha2 };
      await AsyncStorage.setItem('@rascunho_campos', JSON.stringify(dados));
    };
    salvarRascunho();
  }, [estabelecimento, cnpj, endereco, numero, bairro, municipio, estado, cep, horarioAbre, horarioFecha, horarioAbre2, horarioFecha2]);

  useEffect(() => {
    const sincronizarBackupLocal = async () => {
      await AsyncStorage.setItem('@lista_temporaria_backup', JSON.stringify(listaEntregas));
    };
    sincronizarBackupLocal();
  }, [listaEntregas]);

  const aplicarMascaraCNPJ = (valor: string) => {
    const limpo = valor.replace(/\D/g, ''); 
    return limpo
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  useEffect(() => {
    if (cnpj.length === 18) {
      buscarDadosCliente(cnpj);
    }
  }, [cnpj]);

  async function buscarDadosCliente(numCnpj: string) {
    setBuscandoCNPJ(true);
    try {
      const { data, error } = await supabase
        .from('entregas')
        .select('estabelecimento, endereco, numero, bairro, municipio, cep, horario_abre_1, horario_fecha_1, horario_abre_2, horario_fecha_2')
        .eq('cnpj', numCnpj)
        .limit(1)
        .single();

      if (data && !error) {
        setEstabelecimento(data.estabelecimento || '');
        
        // Ajuste: Limpa o endereï¿½o caso venha com o CEP grudado do banco
        const enderecoLimpo = data.endereco ? data.endereco.split(' - CEP:')[0] : '';
        setEndereco(enderecoLimpo);
        
        // Ajuste: Preenche o campo Nï¿½mero automaticamente com o dado do banco
        setNumero(data.numero || ''); 
        
        setBairro(data.bairro || '');
        setMunicipio(data.municipio || '');
        setCep(data.cep || '');
        setHorarioAbre(data.horario_abre_1 || '');
        setHorarioFecha(data.horario_fecha_1 || '');
        setHorarioAbre2(data.horario_abre_2 || '');
        setHorarioFecha2(data.horario_fecha_2 || '');
      }
    } catch (err) { console.log("Cliente nï¿½o encontrado."); } 
    finally { setBuscandoCNPJ(false); }
  }

  const adicionarNaLista = () => {
    if (!estabelecimento || !endereco) {
      Alert.alert("Atenï¿½ï¿½o", "Preencha o estabelecimento e o endereï¿½o.");
      return;
    }

    const novaEntrega = { 
        estabelecimento, 
        cnpj, 
        endereco, // Mantï¿½m separado
        numero,   // Mantï¿½m separado
        bairro, 
        municipio, 
        cep,
        horario_abre_1: horarioAbre, 
        horario_fecha_1: horarioFecha,
        horario_abre_2: horarioAbre2, 
        horario_fecha_2: horarioFecha2,
        concluido: false
    };

    setListaEntregas([...listaEntregas, novaEntrega]);
    
    // Limpa os campos apï¿½s adicionar
    setEstabelecimento(''); setCnpj(''); setEndereco(''); setNumero(''); setBairro(''); setMunicipio(''); setEstado(''); setCep('');
    setHorarioAbre(''); setHorarioFecha(''); setHorarioAbre2(''); setHorarioFecha2('');
  };

  async function salvarEntrega() {
    let entregasParaEnviar = [...listaEntregas];
    
    if (estabelecimento && endereco) {
      entregasParaEnviar.push({ 
        estabelecimento, 
        cnpj, 
        endereco, 
        numero, 
        bairro, 
        municipio, 
        cep,
        horario_abre_1: horarioAbre, 
        horario_fecha_1: horarioFecha,
        horario_abre_2: horarioAbre2, 
        horario_fecha_2: horarioFecha2,
        concluido: false
      });
    }

    if (entregasParaEnviar.length === 0) {
      Alert.alert("Atenï¿½ï¿½o", "Adicione ao menos uma entrega.");
      return;
    }

    setCarregando(true);
    try {
      await supabase
        .from('entregas')
        .upsert(entregasParaEnviar.map(item => ({ 
            estabelecimento: item.estabelecimento,
            cnpj: item.cnpj,
            endereco: item.endereco,
            numero: item.numero, // Salvando na coluna 'numero' separada
            bairro: item.bairro,
            municipio: item.municipio,
            cep: item.cep,
            horario_abre_1: item.horario_abre_1,
            horario_fecha_1: item.horario_fecha_1,
            horario_abre_2: item.horario_abre_2,
            horario_fecha_2: item.horario_fecha_2,
            veiculo_placa: dadosSessao?.veiculo || '---', 
            created_at: new Date() 
         })), { onConflict: 'cnpj' });

      if (dadosSessao?.id) {
          const { data: rotaExistente } = await supabase
            .from('rotas_diarias')
            .select('id')
            .eq('motorista_id', dadosSessao.id)
            .eq('status', 'em_andamento')
            .maybeSingle();

          if (rotaExistente) {
            await supabase
              .from('rotas_diarias')
              .update({ 
                lista_entregas: entregasParaEnviar,
                veiculo_placa: dadosSessao.veiculo, 
                data_inicio: new Date()
              })
              .eq('id', rotaExistente.id);
          } else {
            await supabase
              .from('rotas_diarias')
              .insert([{
                motorista_id: dadosSessao.id,
                veiculo_placa: dadosSessao.veiculo,
                status: 'em_andamento',
                lista_entregas: entregasParaEnviar,
                data_inicio: new Date()
              }]);
          }
      }

      await AsyncStorage.removeItem('@rascunho_campos');
      await AsyncStorage.removeItem('@lista_temporaria_backup');
      
      router.replace({ 
        pathname: '/lista_rota', 
        params: { entregas: JSON.stringify(entregasParaEnviar) } 
      });
      
      setListaEntregas([]);

    } catch (error: any) {
      Alert.alert("Erro", "Falha ao salvar rota. Verifique sua conexï¿½o.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.safeAreaWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#16319e" translucent={false} />
      <SafeAreaView style={styles.container}>
        <View style={styles.topoMotorista}>
          <View style={styles.topoInfo}>
            <Ionicons name="person-circle" size={45} color="#FFF" />
            <View style={styles.topoTexto}>
              <Text style={styles.txtOla}>Olï¿½, {dadosSessao?.nome || 'Motorista'}</Text>
              <Text style={styles.txtVeiculo}>Veï¿½culo: {dadosSessao?.veiculo || '---'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={encerrarSessao} style={styles.btnSair}>
            <Ionicons name="log-out-outline" size={26} color="#FFF" />
            <Text style={styles.txtSair}>Sair</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.blueBanner}>
          <Text style={styles.bannerText}>Cadastrar Entregas da Rota</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Nome do Estabelecimento</Text>
          <TextInput style={styles.input} placeholder="Ex: Mercado Silva" value={estabelecimento} onChangeText={setEstabelecimento} />

          <Text style={styles.label}>CNPJ do Cliente</Text>
          <View style={styles.inputContainerRow}>
            <TextInput 
              style={[styles.input, { flex: 1 }]} 
              placeholder="00.000.000/0001-00" 
              keyboardType="numeric" 
              value={cnpj}
              onChangeText={(text) => setCnpj(aplicarMascaraCNPJ(text))}
            />
            {buscandoCNPJ && <ActivityIndicator style={{ marginLeft: 10 }} color="#0033ff" />}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 3, marginRight: 10 }}>
              <Text style={styles.label}>Endereï¿½o de Entrega</Text>
              <View style={styles.inputComMicrofone}>
                <TextInput 
                  style={styles.inputEndereco} 
                  placeholder="Rua / Av" 
                  value={endereco} 
                  onChangeText={setEndereco} 
                />
                <TouchableOpacity 
                  onPress={ouvirEndereco}
                  style={[styles.btnMicrofone, ouvindoEndereco && styles.btnMicrofoneAtivo]}
                  disabled={ouvindoEndereco}
                >
                  {ouvindoEndereco ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="mic" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nï¿½mero</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: 10" 
                keyboardType="numeric"
                value={numero} 
                onChangeText={setNumero} 
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.label}>Bairro</Text>
              <TextInput style={styles.input} placeholder="Bairro" value={bairro} onChangeText={setBairro} />
            </View>
            <View style={{ flex: 2, marginRight: 10 }}>
              <Text style={styles.label}>Municï¿½pio</Text>
              <TextInput style={styles.input} placeholder="Cidade" value={municipio} onChangeText={setMunicipio} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>UF</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: SC" 
                maxLength={2} 
                autoCapitalize="characters"
                value={estado} 
                onChangeText={(t) => setEstado(t.toUpperCase())} 
              />
            </View>
          </View>

          <Text style={styles.label}>CEP</Text>
          <View style={styles.inputContainerRow}>
            <TextInput 
              style={[styles.input, { flex: 1 }]} 
              placeholder="00000-000" 
              keyboardType="numeric" 
              value={cep} 
              onChangeText={(texto) => {
                  const formatado = aplicarMascaraCEP(texto);
                  setCep(formatado);
                  buscarCepAutomatico(formatado);
              }} 
              maxLength={9}
            />
            <TouchableOpacity 
              onPress={buscarCepPeloEndereco} 
              style={{ marginLeft: 10, backgroundColor: '#0033ff', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
            >
              {buscandoCep ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnAddMore} onPress={adicionarNaLista}>
            <Ionicons name="add-circle" size={20} color="#0033ff" />
            <Text style={styles.btnAddMoreText}> ADICIONAR OUTRA ENTREGA</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnConfirmar, { opacity: carregando ? 0.7 : 1 }]} 
            onPress={salvarEntrega}
            disabled={carregando}
          >
            {carregando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnConfirmarText}>CONFIRMAR E INICIAR ROTA</Text>}
          </TouchableOpacity>

          {listaEntregas.length > 0 && (
            <View style={styles.containerLista}>
              <Text style={styles.tituloLista}>Lista Temporï¿½ria ({listaEntregas.length})</Text>
              {listaEntregas.map((item, index) => (
                <View key={index} style={styles.cardEntrega}>
                  <View style={styles.cardInfo}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Text style={styles.cardEstabelecimento}>{index + 1}. {item.estabelecimento}</Text>
                        {item.horario_abre_1 ? <Text style={styles.horarioTexto}> ({item.horario_abre_1}-{item.horario_fecha_1})</Text> : null}
                     </View>
                     <Text style={styles.cardEndereco}>{item.endereco}{item.numero ? `, ${item.numero}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setListaEntregas(listaEntregas.filter((_, i) => i !== index))}>
                     <Ionicons name="trash-outline" size={20} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaWrapper: { flex: 1, backgroundColor: 'white' },
  container: { flex: 1, backgroundColor: '#FFF' },
  topoMotorista: { backgroundColor: '#16319e', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topoInfo: { flexDirection: 'row', alignItems: 'center' },
  topoTexto: { marginLeft: 12 },
  txtOla: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  txtVeiculo: { color: '#aab6ff', fontSize: 12 },
  btnSair: { alignItems: 'center', justifyContent: 'center' },
  txtSair: { color: '#FFF', fontSize: 10, fontWeight: 'bold', marginTop: -2 },
  blueBanner: { backgroundColor: '#0033ff', padding: 15, alignItems: 'center' },
  bannerText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#444', marginBottom: 5, marginTop: 15 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#DDD', color: '#333' },
  inputContainerRow: { flexDirection: 'row', alignItems: 'center' },
  inputComMicrofone: { flexDirection: 'row', alignItems: 'center' },
  inputEndereco: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#DDD', color: '#333' },
  btnMicrofone: { marginLeft: 8, width: 44, height: 44, backgroundColor: '#0033ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnMicrofoneAtivo: { backgroundColor: '#16319e' },
  row: { flexDirection: 'row' },
  btnAddMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#0033ff', borderRadius: 8, marginTop: 25 },
  btnAddMoreText: { color: '#0033ff', fontWeight: 'bold' },
  btnConfirmar: { backgroundColor: '#28a745', height: 60, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  btnConfirmarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  containerLista: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 20 },
  tituloLista: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  cardEntrega: { flexDirection: 'row', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#EEE' },
  cardInfo: { flex: 1 },
  cardEstabelecimento: { fontWeight: 'bold', color: '#0033ff', fontSize: 14 },
  cardEndereco: { color: '#666', fontSize: 12, marginTop: 2 },
  horarioTexto: { color: '#ff8c00', fontWeight: 'bold', fontSize: 12 }
});