import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';

export default function MotoristasScreen() {
  const router = useRouter();
  
  // Estados para os campos do formulário
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [toxicologico, setToxicologico] = useState('');
  const [documento, setDocumento] = useState('');
  const [senhaMotorista, setSenhaMotorista] = useState('');
  const [carregando, setCarregando] = useState(false);
  
  // Estados para controle de lista e edição
  const [listaMotoristas, setListaMotoristas] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function buscarMotoristas() {
    const { data, error } = await supabase
      .from('motoristas')
      .select('*')
      .order('ativo', { ascending: false }) // Mostra os ativos primeiro
      .order('nome', { ascending: true });

    if (!error && data) {
      setListaMotoristas(data);
    }
  }

  useEffect(() => {
    buscarMotoristas();
  }, []);

  // Preenche o formulário com os dados do motorista para editar
  function prepararEdicao(motorista: any) {
    setNome(motorista.nome);
    setIdade(motorista.idade ? motorista.idade.toString() : '');
    setToxicologico(motorista.toxicologico || '');
    setDocumento(motorista.documento);
    setSenhaMotorista(motorista.senha);
    setEditandoId(motorista.id);
    Alert.alert("Modo Edição", "Altere os dados nos campos acima.");
  }

  function limparCampos() {
    setNome('');
    setIdade('');
    setToxicologico('');
    setDocumento('');
    setSenhaMotorista('');
    setEditandoId(null);
  }

  // NOVA LÓGICA: Em vez de deletar, desativa o motorista para manter histórico
  async function desligarMotorista(id: string, nomeMotorista: string, statusAtual: boolean) {
    const mensagem = statusAtual 
      ? `Deseja DESLIGAR o motorista ${nomeMotorista}? Ele perderá o acesso, mas o histórico será mantido.`
      : `Deseja REATIVAR o motorista ${nomeMotorista}?`;

    Alert.alert(
      statusAtual ? "Confirmar Desligamento" : "Confirmar Reativação",
      mensagem,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: statusAtual ? "Desligar" : "Reativar", 
          style: statusAtual ? "destructive" : "default", 
          onPress: async () => {
            const { error } = await supabase
              .from('motoristas')
              .update({ ativo: !statusAtual }) // Inverte o status atual
              .eq('id', id);

            if (error) {
              Alert.alert("Erro", "Não foi possível alterar o status do motorista.");
            } else {
              Alert.alert("Sucesso", statusAtual ? "Motorista desligado." : "Motorista reativado.");
              buscarMotoristas();
            }
          }
        }
      ]
    );
  }

  // Formatação automática de CPF/CNH (11 dígitos) e CNPJ (14 dígitos)
  const handleDocumentoChange = (texto: string) => {
    let apenasNumeros = texto.replace(/\D/g, '');
    
    if (apenasNumeros.length > 14) {
      apenasNumeros = apenasNumeros.substring(0, 14);
    }

    let formatado = apenasNumeros;

    if (apenasNumeros.length <= 11) {
      formatado = formatado.replace(/(\d{3})(\d)/, '$1.$2');
      formatado = formatado.replace(/(\d{3})(\d)/, '$1.$2');
      formatado = formatado.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      formatado = formatado.replace(/^(\d{2})(\d)/, '$1.$2');
      formatado = formatado.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      formatado = formatado.replace(/\.(\d{3})(\d)/, '.$1/$2');
      formatado = formatado.replace(/(\d{4})(\d)/, '$1-$2');
    }

    setDocumento(formatado);
  };

  // Formatação de Data com Validação de Dias e Meses
  const handleToxicologicoChange = (texto: string) => {
    let apenasNumeros = texto.replace(/\D/g, '');
    
    if (apenasNumeros.length > 8) {
      apenasNumeros = apenasNumeros.substring(0, 8);
    }

    let formatado = apenasNumeros;

    if (apenasNumeros.length >= 2) {
      let dia = parseInt(apenasNumeros.substring(0, 2), 10);
      if (dia > 31) dia = 31;
      formatado = dia.toString().padStart(2, '0') + apenasNumeros.substring(2);
    }

    if (apenasNumeros.length >= 4) {
      let mes = parseInt(formatado.substring(2, 4), 10);
      if (mes > 12) mes = 12;
      formatado = formatado.substring(0, 2) + mes.toString().padStart(2, '0') + formatado.substring(4);
    }

    if (formatado.length > 2 && formatado.length <= 4) {
      formatado = formatado.replace(/(\d{2})(\d+)/, '$1/$2');
    } else if (formatado.length > 4) {
      formatado = formatado.replace(/(\d{2})(\d{2})(\d+)/, '$1/$2/$3');
    }

    setToxicologico(formatado);
  };

  // Garante que a senha receba apenas números
  const handleSenhaChange = (texto: string) => {
    const apenasNumeros = texto.replace(/\D/g, '');
    setSenhaMotorista(apenasNumeros);
  };

  async function gerenciarSalvar() {
    if (!nome || !documento || !senhaMotorista) {
      Alert.alert("Atenção", "Nome, Documento e Senha são obrigatórios!");
      return;
    }

    setCarregando(true);

    const dados = { 
      nome, 
      idade: idade ? parseInt(idade) : null, 
      toxicologico, 
      documento, 
      senha: senhaMotorista,
      ativo: true // Sempre salva/atualiza como ativo por padrão ao editar/criar
    };

    try {
      if (editandoId) {
        const { error } = await supabase
          .from('motoristas')
          .update(dados)
          .eq('id', editandoId);

        if (error) throw error;
        Alert.alert("Sucesso", "Dados atualizados com sucesso!");
      } else {
        const { error } = await supabase.from('motoristas').insert([dados]);
        if (error) throw error;
        Alert.alert("Sucesso", "Motorista cadastrado!");
      }

      limparCampos();
      buscarMotoristas();
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
        <Text style={styles.navbarTitle}>Gerenciar Motoristas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput style={styles.input} placeholder="Ex: João Silva" value={nome} onChangeText={setNome} />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>Idade</Text>
            <TextInput style={styles.input} placeholder="Ex: 35" keyboardType="numeric" value={idade} onChangeText={setIdade} />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Documento (CPF/CNH)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="000.000.000-00" 
              value={documento} 
              onChangeText={handleDocumentoChange} 
              keyboardType="numeric"
              maxLength={18} 
            />
          </View>
        </View>

        <Text style={styles.label}>Vencimento Toxicológico</Text>
        <TextInput 
          style={styles.input} 
          placeholder="DD/MM/AAAA" 
          value={toxicologico} 
          onChangeText={handleToxicologicoChange} 
          keyboardType="numeric"
          maxLength={10}
        />

        <Text style={styles.label}>Senha de Acesso</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Apenas números" 
          secureTextEntry 
          value={senhaMotorista} 
          onChangeText={handleSenhaChange} 
          keyboardType="numeric"
        />

        <TouchableOpacity 
          style={[styles.btnSalvar, { backgroundColor: editandoId ? '#FF9800' : '#006699' }]} 
          onPress={gerenciarSalvar}
          disabled={carregando}
        >
          {carregando ? <ActivityIndicator color="#FFF" /> : (
            <Text style={styles.btnSalvarText}>{editandoId ? "ATUALIZAR DADOS" : "CADASTRAR MOTORISTA"}</Text>
          )}
        </TouchableOpacity>

        {editandoId && (
          <TouchableOpacity onPress={limparCampos} style={{ marginTop: 15 }}>
            <Text style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>Cancelar Edição</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />
        <Text style={styles.listaTitle}>Motoristas Cadastrados</Text>
        
        {listaMotoristas.map((m) => (
          <View key={m.id} style={[styles.cardMotorista, !m.ativo && { backgroundColor: '#F0F0F0', borderColor: '#CCC' }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.txtNomeLista, !m.ativo && { color: '#888' }]}>{m.nome}</Text>
                {!m.ativo && (
                  <Text style={{ color: 'red', fontSize: 10, fontWeight: 'bold', marginLeft: 5 }}>(DESLIGADO)</Text>
                )}
              </View>
              <Text style={styles.txtDocLista}>CPF: {m.documento}</Text>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => prepararEdicao(m)} style={styles.btnEditar}>
                <Ionicons name="create-outline" size={24} color={m.ativo ? "#006699" : "#AAA"} />
              </TouchableOpacity>

              {/* Botão de Excluir alterado para Desligar (Inativar) */}
              <TouchableOpacity onPress={() => desligarMotorista(m.id, m.nome, m.ativo)} style={styles.btnDeletar}>
                <Ionicons 
                  name={m.ativo ? "person-remove-outline" : "person-add-outline"} 
                  size={25} 
                  color={m.ativo ? "#FF3B30" : "#28a745"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  navbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 60, borderBottomWidth: 0.5, borderBottomColor: '#EEE', marginTop: 30 },
  btnBack: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 20 },
  txtBack: { fontSize: 14, fontWeight: '500', marginLeft: 2 },
  navbarTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 15 },
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 15, fontSize: 16, backgroundColor: '#FDFDFD' },
  row: { flexDirection: 'row' },
  btnSalvar: { height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  btnSalvarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#EEE', marginTop: 15, marginBottom: 20 },
  listaTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  cardMotorista: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  txtNomeLista: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  txtDocLista: { fontSize: 13, color: '#666' },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  btnEditar: { padding: 5, marginLeft: 10 },
  btnDeletar: { padding: 5, marginLeft: 10 }
});