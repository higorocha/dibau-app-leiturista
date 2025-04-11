// src/screens/auth/BackgroundIcons.tsx
import React, { useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { SvgProps } from 'react-native-svg';

// Importar os ícones SVG diretamente
// Nota: Os caminhos podem precisar de ajuste dependendo da estrutura exata das pastas
import MilhoSvg from '../../../assets/icons/milho.svg';
import AppleSvg from '../../../assets/icons/apple.svg';
import MelanciaSvg from '../../../assets/icons/melancia.svg';
import BananaSvg from '../../../assets/icons/banana.svg';
import TomateSvg from '../../../assets/icons/tomate.svg';
import WateringSvg from '../../../assets/icons/watering.svg';
import CenouraSvg from '../../../assets/icons/cenoura.svg';
import TratorSvg from '../../../assets/icons/trator.svg';
import Trator2Svg from '../../../assets/icons/trator2.svg';
import Coconut1Svg from '../../../assets/icons/coconut1.svg';
import Coconut2Svg from '../../../assets/icons/coconut2.svg';
import ChuvaSvg from '../../../assets/icons/chuva.svg';
import ShearsSvg from '../../../assets/icons/shears.svg';
import BarnSvg from '../../../assets/icons/barn.svg';
import CacaoSvg from '../../../assets/icons/cacao.svg';
import AgricultorSvg from '../../../assets/icons/agricultor.svg';
import Agricultor2Svg from '../../../assets/icons/agricultor2.svg';

// Obter dimensões da tela
const { width, height } = Dimensions.get('window');

// Mapeamento de nomes de ícones para componentes SVG
const iconComponents: Record<string, React.FC<SvgProps>> = {
  "milho": MilhoSvg,
  "apple": AppleSvg,
  "melancia": MelanciaSvg,
  "banana": BananaSvg,
  "tomate": TomateSvg,
  "watering": WateringSvg,
  "cenoura": CenouraSvg,
  "trator": TratorSvg,
  "trator2": Trator2Svg,
  "coconut1": Coconut1Svg,
  "coconut2": Coconut2Svg,
  "chuva": ChuvaSvg,
  "shears": ShearsSvg,
  "barn": BarnSvg,
  "cacao": CacaoSvg,
  "agricultor": AgricultorSvg,
  "agricultor2": Agricultor2Svg,
};

// Define as interfaces para tipagem
interface FruitIcon {
  icon: string;
}

interface Position {
  top: number;
  left: number;
}

interface AnimatedIconProps {
  icon: string;
  top: number;
  left: number;
  delay: number;
  size: number;
  rotation: number;
}

// Lista de ícones
export const fruitIcons: FruitIcon[] = [
  { icon: "milho" },
  { icon: "apple" },
  { icon: "melancia" },
  { icon: "banana" },
  { icon: "tomate" },
  { icon: "watering"},
  { icon: "cenoura"},
  { icon: "trator"},
  { icon: "trator2"},
  { icon: "coconut1"},
  { icon: "coconut2"},
  { icon: "chuva"},
  { icon: "shears"},
  { icon: "barn"},
  { icon: "cacao"},
  { icon: "agricultor"},
  { icon: "agricultor2"},
];

// Componente de ícone animado
const AnimatedIcon: React.FC<AnimatedIconProps> = ({ icon, top, left, delay, size, rotation }) => {
  const floatAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [delay]);
  
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20]
  });

  const rotate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${rotation}deg`, `${rotation + 5}deg`]
  });
  
  // Obter o componente SVG
  const IconComponent = iconComponents[icon];
  
  if (!IconComponent) return null;
  
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: top * height / 100,
        left: left * width / 100,
        opacity: 0.2,
        transform: [
          { translateY },
          { rotate }
        ]
      }}
    >
      <IconComponent width={size} height={size} />
    </Animated.View>
  );
};

const BackgroundIcons: React.FC = () => {
  // Função para verificar distância entre posições
  const isPositionValid = (newPos: Position, positions: Position[], minDistance: number): boolean => {
    return positions.every(pos => {
      const distance = Math.sqrt(
        Math.pow(newPos.top - pos.top, 2) + Math.pow(newPos.left - pos.left, 2)
      );
      return distance >= minDistance;
    });
  };

  // Função para gerar posições únicas
  const generatePositions = (count: number, minDistance: number): Position[] => {
    const positions: Position[] = [];
    const maxAttempts = 100; 

    while (positions.length < count) {
      let attempts = 0;
      let validPosition = false;

      while (!validPosition && attempts < maxAttempts) {
        const section = Math.floor(Math.random() * 9);
        const baseTop = Math.floor(section / 3) * 33.33;
        const baseLeft = (section % 3) * 33.33;

        const top = baseTop + Math.random() * 30;
        const left = baseLeft + Math.random() * 30;

        const newPosition = { top, left };
        if (isPositionValid(newPosition, positions, minDistance)) {
          positions.push(newPosition);
          validPosition = true;
        }

        attempts++;
      }

      if (!validPosition) {
        const section = Math.floor(Math.random() * 9);
        const baseTop = Math.floor(section / 3) * 33.33;
        const baseLeft = (section % 3) * 33.33;

        positions.push({
          top: baseTop + Math.random() * 30,
          left: baseLeft + Math.random() * 30
        });
      }
    }

    return positions;
  };

  // Gerar posições para todos os ícones - reduzido para 4 por ícone para melhor performance
  const minDistance = 15;
  const iconCount = fruitIcons.length * 4; 
  const positions = useMemo(() => generatePositions(iconCount, minDistance), []);

  // Criar componentes para todos os ícones
  const icons = fruitIcons.flatMap((fruit, index) =>
    Array(4).fill(null).map((_, i) => {
      const posIndex = index * 4 + i;
      if (posIndex >= positions.length) return null;
      
      const pos = positions[posIndex];
      if (!pos) return null;
      
      const delay = Math.random() * 2000;
      const size = Math.random() * 20 + 40;
      const rotation = Math.random() * 360;

      return (
        <AnimatedIcon
          key={`${fruit.icon}-${i}`}
          icon={fruit.icon}
          top={pos.top}
          left={pos.left}
          delay={delay}
          size={size}
          rotation={rotation}
        />
      );
    })
  ).filter(icon => icon !== null); // Filtrar elementos nulos

  return <View style={styles.container}>{icons}</View>;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});

export default React.memo(BackgroundIcons);