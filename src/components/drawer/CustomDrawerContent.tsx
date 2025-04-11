// src/components/drawer/CustomDrawerContent.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@react-navigation/native";
import moment from "moment-timezone";
import "moment/locale/pt-br";
moment.locale("pt-br");

const { width } = Dimensions.get("window");
const isTablet = width > 600;

const CustomDrawerContent = (props: any) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  // Obter as iniciais do nome do usuário
  const getUserInitials = useMemo(() => {
    if (!user || !user.nome) return "??";

    // Separa o nome em partes
    const nameParts = user.nome.split(" ").filter((part) => part.length > 0);

    if (nameParts.length === 0) return "??";
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();

    // Pega a primeira letra do primeiro e último nome
    return (
      nameParts[0].charAt(0).toUpperCase() +
      nameParts[nameParts.length - 1].charAt(0).toUpperCase()
    );
  }, [user]);

  // Formatar a data do último acesso usando moment-timezone
  const formatLastAccess = useMemo(() => {
    if (!user || !user.ultimoAcesso) return "Não disponível";

    try {
      // Converte a data UTC para o fuso horário de Brasília
      return moment(user.ultimoAcesso)
        .tz("America/Sao_Paulo")
        .format("D [de] MMMM [de] YYYY [às] HH:mm");
    } catch (error) {
      console.error("Erro ao formatar data de último acesso:", error);
      return "Não disponível";
    }
  }, [user]);

  // Gerar saudação baseada na hora do dia
  const greeting = useMemo(() => {
    const currentHour = new Date().getHours();

    if (currentHour < 12) return "Bom dia";
    if (currentHour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  return (
    <View style={styles.container}>
      {/* Cabeçalho do Drawer */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        {/* Avatar do Usuário com Iniciais */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getUserInitials}</Text>
          </View>
        </View>

        {/* Saudação e Nome do Usuário */}
        <Text style={styles.greeting}>
          {greeting},{" "}
          <Text style={styles.userName}>{user?.nome || "Usuário"}</Text>
        </Text>

        {/* Último Acesso */}
        <View style={styles.lastAccessContainer}>
          <Ionicons
            name="time-outline"
            size={16}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.lastAccessText}>
            Último acesso: {formatLastAccess}
          </Text>
        </View>
      </View>

      {/* Área flexível com conteúdo do drawer */}
      <View style={styles.drawerContentContainer}>
        {/* Lista de itens de navegação */}
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawerScrollContent}
        >
          {/* Opções de menu estilizadas */}
          <View style={styles.menuContainer}>
            {/* Item Início */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                props.navigation.navigate("(tabs)", { screen: "index" });
                props.navigation.closeDrawer();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="home-outline" size={24} color="#008bac" />
              </View>
              <Text style={styles.menuText}>Início</Text>
            </TouchableOpacity>

            {/* Item Leituras */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                props.navigation.navigate("(tabs)", { screen: "leituras" });
                props.navigation.closeDrawer();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="water-outline" size={24} color="#008bac" />
              </View>
              <Text style={styles.menuText}>Leituras</Text>
            </TouchableOpacity>
          </View>
        </DrawerContentScrollView>

        {/* Botão de Sair (agora posicionado no final da área flexível) */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => logout()}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#ff4757" />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Rodapé do Drawer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sistemas de Informações - DIBAU</Text>

        <View style={styles.logosContainer}>
          {/* Logo DIBAU */}
          <View style={styles.logoWrapper}>
            <Text style={styles.logoText}>DIBAU</Text>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>

          {/* Separador */}
          <View style={styles.divider}></View>

          {/* Logo DNOCS */}
          <View style={styles.logoWrapper}>
            <Text style={styles.logoText}>DNOCS</Text>
            <Image
              source={require("@/assets/images/dnocs.png")}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 44 : 16,
    paddingBottom: 24,
    backgroundColor: "#008bac99",
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: isTablet ? 40 : 30,
    backgroundColor: "#ffffff33",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff66",
  },
  avatarText: {
    fontSize: isTablet ? 32 : 24,
    fontWeight: "bold",
    color: "white",
  },
  greeting: {
    fontSize: isTablet ? 16 : 14,
    color: "white",
    marginBottom: 4,
    textAlign: "center",
  },
  userName: {
    fontWeight: "bold",
  },
  lastAccessContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  lastAccessText: {
    fontSize: isTablet ? 13 : 11,
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },
  drawerContentContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  drawerScrollContent: {
    paddingTop: 16,
  },
  menuContainer: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 139, 172, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: isTablet ? 16 : 14,
    color: "#333333",
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#f0f0f0",
    marginBottom: 8,
  },
  logoutText: {
    marginLeft: 32,
    fontSize: isTablet ? 16 : 14,
    fontWeight: "500",
    color: "#ff4757",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    alignItems: "center",
  },
  footerText: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  logosContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  logoText: {
    fontSize: isTablet ? 12 : 10,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  footerLogo: {
    width: isTablet ? 60 : 40,
    height: isTablet ? 24 : 16,
  },
  divider: {
    height: isTablet ? 30 : 24,
    width: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 12,
  },
});

export default CustomDrawerContent;