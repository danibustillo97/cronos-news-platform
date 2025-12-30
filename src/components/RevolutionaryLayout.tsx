'use client'
import React, { useEffect, useState, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Text, Environment, OrbitControls } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import { createClient } from '@supabase/supabase-js'

// Usa variables de entorno para claves sensibles
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxvdnfaeqjifnxqmxbri.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc'
const supabase = createClient(supabaseUrl, supabaseKey)

interface News {
  id: string
  title: string
  content: string
  category?: string
  image_url?: string
  published_at: string
}

type CameraPreset = 'wide' | 'medium' | 'close' | 'overhead' | 'side-left' | 'side-right'

// Sistema de control de cámara profesional
function ProfessionalCamera({ preset, auto }: { preset: CameraPreset; auto: boolean }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())

  const presets = {
    'wide': { pos: [0, 2.2, 7], look: [0, 1.8, 0], fov: 55 }, // Ajusté la posición de la cámara
    'medium': { pos: [0, 2, 5], look: [0, 1.8, 0], fov: 45 },
    'close': { pos: [0, 1.9, 3], look: [0, 1.85, 0], fov: 35 },
    'overhead': { pos: [0, 5, 3], look: [0, 1.5, 0], fov: 50 },
    'side-left': { pos: [-3.5, 2, 4], look: [-0.5, 1.8, 0], fov: 45 },
    'side-right': { pos: [3.5, 2, 4], look: [0.5, 1.8, 0], fov: 45 },
  }

  useEffect(() => {
    const p = presets[preset]
    targetPos.current.set(p.pos[0], p.pos[1], p.pos[2])
    targetLook.current.set(p.look[0], p.look[1], p.look[2])
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = p.fov
      camera.updateProjectionMatrix()
    }
  }, [preset, camera])

  useFrame(() => {
    const speed = auto ? 0.02 : 0.08
    camera.position.lerp(targetPos.current, speed)
    const currentLook = new THREE.Vector3()
    camera.getWorldDirection(currentLook)
    currentLook.multiplyScalar(10).add(camera.position)
    currentLook.lerp(targetLook.current, speed)
    camera.lookAt(currentLook)
  })

  return null
}

// Set de TV Ultra Profesional
function BroadcastStudioSet() {
  const floorRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    if (floorRef.current) {
      (floorRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.15 + Math.sin(clock.getElapsedTime() * 0.5) * 0.05
    }
  })

  return (
    <group>
      {/* Piso de estudio profesional (color más claro) */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#3a3a5e" // Color más claro
          metalness={0.95}
          roughness={0.05}
          emissive="#1a1a3e"
          emissiveIntensity={0.2} // Aumenté la intensidad
        />
      </mesh>
      {/* Pared principal con diseño corporativo (color más claro) */}
      <mesh position={[0, 4.5, -5]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial
          color="#2a3a6e" // Color más claro
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Paneles decorativos con iluminación */}
      {[-7, -4, 4, 7].map((x, i) => (
        <group key={`panel-${i}`} position={[x, 4.5, -4.9]}>
          <mesh>
            <boxGeometry args={[1.5, 9, 0.15]} />
            <meshStandardMaterial
              color="#3a4a7e" // Color más claro
              metalness={0.9}
              roughness={0.1}
              emissive={i % 2 === 0 ? "#0066ff" : "#00ccff"}
              emissiveIntensity={0.6} // Aumenté la intensidad
            />
          </mesh>
          {/* Líneas LED verticales */}
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[0.05, 9, 0.01]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00ffff"
              emissiveIntensity={3} // Aumenté la intensidad
            />
          </mesh>
        </group>
      ))}
      {/* Escritorio principal premium */}
      <group position={[0, 0, 1]}>
        {/* Mesa superior */}
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[3.5, 0.08, 1.8]} />
          <meshStandardMaterial
            color="#4a5a8e" // Color más claro
            metalness={0.95}
            roughness={0.05}
            emissive="#2a3a6e"
            emissiveIntensity={0.4} // Aumenté la intensidad
          />
        </mesh>
        {/* Frente del escritorio con branding */}
        <mesh position={[0, 0.7, 0.9]} castShadow>
          <boxGeometry args={[3.4, 0.85, 0.08]} />
          <meshStandardMaterial
            color="#3a4a7e" // Color más claro
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Base del escritorio */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[3.2, 0.5, 1.6]} />
          <meshStandardMaterial color="#2a3a6e" /> // Color más claro
        </mesh>
        {/* Logo en el escritorio */}
        <Text
          position={[0, 0.7, 0.95]}
          fontSize={0.18}
          color="#00ffff"
          font="https://fonts.gstatic.com/s/rajdhani/v15/LDIxapCSOBg7S-QT7p4JM-Fg.woff"
          letterSpacing={0.05}
          outlineWidth={0.015}
          outlineColor="#000033"
        >
          NEXUS LIVE
        </Text>
        {/* Detalles de iluminación LED */}
        <mesh position={[0, 1.16, 0.89]}>
          <boxGeometry args={[3.4, 0.02, 0.02]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={4} // Aumenté la intensidad
          />
        </mesh>
      </group>
      {/* Grid de iluminación del techo */}
      {[...Array(5)].map((_, i) => (
        <group key={`light-${i}`} position={[i * 3 - 6, 7.5, 0]}>
          <mesh>
            <boxGeometry args={[0.8, 0.15, 0.8]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={5} // Aumenté la intensidad
            />
          </mesh>
        </group>
      ))}
      {/* Columnas laterales con efectos LED */}
      {[-6, 6].map((x, idx) => (
        <group key={`column-${idx}`} position={[x, 3, -3]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 6, 32]} />
            <meshStandardMaterial
              color="#3a4a7e" // Color más claro
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          {/* Anillos LED */}
          {[1, 2.5, 4].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <torusGeometry args={[0.18, 0.03, 16, 32]} />
              <meshStandardMaterial
                color="#00ffff"
                emissive="#00ffff"
                emissiveIntensity={3} // Aumenté la intensidad
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* Pantallas flotantes de fondo */}
      {[-3, 0, 3].map((x, i) => (
        <mesh key={`bg-screen-${i}`} position={[x, 5.5, -4.7]}>
          <planeGeometry args={[2, 1.2]} />
          <meshStandardMaterial
            color="#1a3a6e" // Color más claro
            emissive="#0066ff"
            emissiveIntensity={0.5} // Aumenté la intensidad
            opacity={0.8}
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}

// Pantalla de noticias ultra profesional
function NewsDisplay({
  position,
  rotation = [0, 0, 0],
  imageUrl,
  titulo,
  categoria,
  size = [3, 2],
  principal = false
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  imageUrl?: string
  titulo?: string
  categoria?: string
  size?: [number, number]
  principal?: boolean
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const screenRef = useRef<THREE.Mesh>(null!)

  useEffect(() => {
    if (imageUrl) {
      const loader = new THREE.TextureLoader()
      loader.load(
        imageUrl,
        (tex) => setTexture(tex),
        undefined,
        (err) => {
          console.error("Error al cargar textura:", err)
          setTexture(null)
        }
      )
    }
  }, [imageUrl])

  useFrame(({ clock }) => {
    if (screenRef.current && !texture) {
      (screenRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.3 + Math.sin(clock.getElapsedTime() * 2) * 0.2 // Aumenté la intensidad
    }
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Marco premium */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[size[0] + 0.12, size[1] + 0.12, 0.1]} />
        <meshStandardMaterial
          color="#1a1a3e"
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>
      {/* Pantalla */}
      <mesh ref={screenRef}>
        <planeGeometry args={size} />
        {texture ? (
          <meshStandardMaterial
            map={texture}
            emissive="#ffffff"
            emissiveIntensity={0.8} // Aumenté la intensidad
          />
        ) : (
          <meshStandardMaterial
            color="#1a3a6e" // Color más claro
            emissive="#0066ff"
            emissiveIntensity={0.5} // Aumenté la intensidad
          />
        )}
      </mesh>
      {/* Overlay de categoría */}
      {principal && categoria && (
        <Html position={[0, size[1] / 2 - 0.2, 0.01]} center transform>
          <div className="bg-red-600 px-4 py-1 rounded-md shadow-lg">
            <span className="text-white text-xs font-bold uppercase tracking-wider">
              {categoria}
            </span>
          </div>
        </Html>
      )}
      {/* Título de la pantalla */}
      {!principal && titulo && (
        <Text
          position={[0, size[1] / 2 + 0.22, 0.01]}
          fontSize={0.1}
          color="#00ffff"
          anchorX="center"
          font="https://fonts.gstatic.com/s/rajdhani/v15/LDI1apCSOBg7S-QT7q4AOeekWPrP.woff"
          letterSpacing={0.02}
          outlineWidth={0.01}
          outlineColor="#000033"
        >
          {titulo}
        </Text>
      )}
      {/* Bordes LED */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size[0], size[1])]} />
        <lineBasicMaterial color="#00ffff" linewidth={2} />
      </lineSegments>
      {/* Esquinas iluminadas */}
      {[
        [-size[0] / 2, size[1] / 2],
        [size[0] / 2, size[1] / 2],
        [-size[0] / 2, -size[1] / 2],
        [size[0] / 2, -size[1] / 2]
      ].map((corner, i) => (
        <mesh key={i} position={[corner[0], corner[1], 0.02]}>
          <boxGeometry args={[0.08, 0.08, 0.01]} />
          <meshStandardMaterial
            color="#00ffff"
            emissive="#00ffff"
            emissiveIntensity={3} // Aumenté la intensidad
          />
        </mesh>
      ))}
    </group>
  )
}

// Presentador 3D mejorado
function NewsAnchor({ hablando }: { hablando: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const cabezaRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupRef.current) {
      groupRef.current.position.y = 1.2 + Math.sin(t * 1.2) * 0.015
    }
    if (hablando && cabezaRef.current) {
      cabezaRef.current.rotation.y = Math.sin(t * 2.5) * 0.08
      cabezaRef.current.rotation.x = Math.sin(t * 1.8) * 0.04
    } else if (cabezaRef.current) {
      cabezaRef.current.rotation.y = Math.sin(t * 0.3) * 0.03
      cabezaRef.current.rotation.x = 0
    }
  })

  return (
    <group ref={groupRef} position={[0, 1.2, 1]}>
      {/* Cabeza */}
      <mesh ref={cabezaRef} position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshStandardMaterial
          color="#ffd4a3"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {/* Cabello */}
      <mesh position={[0, 1.05, -0.05]} castShadow>
        <sphereGeometry args={[0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
      </mesh>
      {/* Ojos */}
      {[-0.08, 0.08].map((x, i) => (
        <group key={i} position={[x, 0.94, 0.2]}>
          <mesh>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshStandardMaterial color="#1a3a5a" />
          </mesh>
          <mesh position={[0.005, 0.005, 0.04]}>
            <sphereGeometry args={[0.012, 16, 16]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      ))}
      {/* Cejas */}
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 1.02, 0.21]} rotation={[0, 0, i === 0 ? 0.2 : -0.2]}>
          <boxGeometry args={[0.08, 0.015, 0.01]} />
          <meshStandardMaterial color="#1a1a0a" />
        </mesh>
      ))}
      {/* Nariz */}
      <mesh position={[0, 0.88, 0.22]}>
        <coneGeometry args={[0.03, 0.08, 8]} />
        <meshStandardMaterial color="#ffc890" />
      </mesh>
      {/* Boca */}
      <mesh position={[0, 0.78, 0.23]}>
        <boxGeometry args={[hablando ? 0.1 : 0.08, hablando ? 0.05 : 0.02, 0.02]} />
        <meshStandardMaterial color={hablando ? "#8a3a3a" : "#cc6666"} />
      </mesh>
      {/* Orejas */}
      {[-0.23, 0.23].map((x, i) => (
        <mesh key={i} position={[x, 0.9, 0]} rotation={[0, i === 0 ? -0.3 : 0.3, 0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#ffc890" />
        </mesh>
      ))}
      {/* Cuello */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.18]} />
        <meshStandardMaterial color="#ffd4a3" />
      </mesh>
      {/* Traje */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.8, 32]} />
        <meshStandardMaterial
          color="#1a1a3e"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      {/* Camisa */}
      <mesh position={[0, 0.42, 0.26]}>
        <boxGeometry args={[0.42, 0.5, 0.05]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      {/* Cuello de camisa */}
      <mesh position={[0, 0.62, 0.26]}>
        <boxGeometry args={[0.28, 0.08, 0.05]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Corbata */}
      <mesh position={[0, 0.38, 0.29]}>
        <boxGeometry args={[0.09, 0.45, 0.02]} />
        <meshStandardMaterial
          color="#990000"
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      <mesh position={[0, 0.62, 0.29]}>
        <boxGeometry args={[0.09, 0.05, 0.025]} />
        <meshStandardMaterial color="#aa0000" />
      </mesh>
      {/* Hombros */}
      {[-0.38, 0.38].map((x, i) => (
        <mesh key={i} position={[x, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#1a1a3e" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* Brazos */}
      {[-0.45, 0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0]} rotation={[0, 0, i === 0 ? 0.35 : -0.35]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.65]} />
          <meshStandardMaterial color="#1a1a3e" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      {/* Manos */}
      {[-0.65, 0.65].map((x, i) => (
        <mesh key={i} position={[x, -0.12, 0.15]} castShadow>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#ffd4a3" />
        </mesh>
      ))}
      {/* Efecto de voz */}
      {hablando && (
        <>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial
              color="#00ffff"
              transparent
              opacity={0.15}
              wireframe
            />
          </mesh>
          <pointLight position={[0, 0.9, 0.5]} intensity={1} color="#00ffff" distance={3} />
        </>
      )}
    </group>
  )
}

// Sistema de broadcast completo
function BroadcastSystem({ news }: { news: News[] }) {
  const [indice, setIndice] = useState(0)
  const [hablando, setHablando] = useState(false)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('wide')
  const [autoCamera, setAutoCamera] = useState(true)

  useEffect(() => {
    if (!news.length) return
    const noticia = news[indice]
    const texto = `Buenas tardes. ${noticia.category ? `En la sección de ${noticia.category}.` : ''} ${noticia.title}. ${noticia.content.substring(0, 200)}`
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = 'es-CO'
    voz.rate = 0.95
    voz.pitch = 1
    voz.volume = 1
    voz.onstart = () => setHablando(true)
    voz.onend = () => {
      setHablando(false)
      setTimeout(() => {
        setIndice(i => (i + 1) % news.length)
        if (autoCamera) {
          const presets: CameraPreset[] = ['wide', 'medium', 'close', 'side-left', 'side-right']
          setCameraPreset(presets[Math.floor(Math.random() * presets.length)])
        }
      }, 4000)
    }
    window.speechSynthesis.speak(voz)
    return () => window.speechSynthesis.cancel()
  }, [indice, news, autoCamera])

  if (!news.length) return null
  const currentNews = news[indice]

  return (
    <>
      <ProfessionalCamera preset={cameraPreset} auto={autoCamera} />
      {/* Luces adicionales */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 5, 0]} intensity={1.5} color="#ffffff" />
      {/* Pantalla principal */}
      <NewsDisplay
        position={[0, 4, -3.5]}
        imageUrl={currentNews.image_url}
        titulo={currentNews.title}
        categoria={currentNews.category}
        size={[5.5, 3.2]}
        principal={true}
      />
      {/* Pantallas laterales */}
      <NewsDisplay
        position={[-4.2, 3, -3]}
        rotation={[0, 0.3, 0]}
        imageUrl={news[(indice + 1) % news.length]?.image_url}
        titulo="PRÓXIMA NOTICIA"
        size={[2.5, 1.8]}
      />
      <NewsDisplay
        position={[4.2, 3, -3]}
        rotation={[0, -0.3, 0]}
        imageUrl={news[(indice + 2) % news.length]?.image_url}
        titulo="ÚLTIMA HORA"
        size={[2.5, 1.8]}
      />
      {/* Pantallas superiores */}
      <NewsDisplay
        position={[-3, 6.2, -3.5]}
        imageUrl={news[(indice + 3) % news.length]?.image_url}
        titulo="EN VIVO"
        size={[1.5, 1]}
      />
      <NewsDisplay
        position={[0, 6.2, -3.5]}
        imageUrl={news[(indice + 4) % news.length]?.image_url}
        titulo="ACTUALIDAD"
        size={[1.5, 1]}
      />
      <NewsDisplay
        position={[3, 6.2, -3.5]}
        imageUrl={news[(indice + 5) % news.length]?.image_url}
        titulo="MUNDO"
        size={[1.5, 1]}
      />
      <NewsAnchor hablando={hablando} />
      {/* Chyron */}
      <Html position={[0, 0.3, 3]} center transform>
        <AnimatePresence mode="wait">
          <motion.div
            key={indice}
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-r from-blue-900/95 via-blue-800/95 to-blue-900/95 backdrop-blur-xl px-8 py-3 rounded-xl border-l-4 border-cyan-400 shadow-2xl w-[700px]"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-cyan-300 text-xs font-bold uppercase tracking-wider">
                {currentNews.category || 'Breaking News'}
              </span>
              <span className="text-gray-400 text-xs">•</span>
              <span className="text-gray-300 text-xs">
                {new Date(currentNews.published_at).toLocaleString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <h3 className="text-white text-base font-bold leading-tight">
              {currentNews.title}
            </h3>
          </motion.div>
        </AnimatePresence>
      </Html>
      {/* Panel de control de cámaras */}
      <Html position={[0, -1, 3]} center>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/90 backdrop-blur-xl px-6 py-4 rounded-xl border border-cyan-400/50"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-cyan-300 text-xs font-bold uppercase">Control de Cámaras</span>
            <button
              onClick={() => setAutoCamera(!autoCamera)}
              className={`px-3 py-1 rounded text-xs font-bold ${autoCamera ? 'bg-green-600' : 'bg-gray-600'
                } text-white`}
            >
              {autoCamera ? 'AUTO' : 'MANUAL'}
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {(['wide', 'medium', 'close', 'overhead', 'side-left', 'side-right'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setAutoCamera(false)
                  setCameraPreset(preset)
                }}
                className={`px-3 py-2 rounded text-xs font-bold transition-all ${cameraPreset === preset && !autoCamera
                    ? 'bg-cyan-500 text-black'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
              >
                {preset.toUpperCase()}
              </button>
            ))}
          </div>
        </motion.div>
      </Html>
    </>
  )
}

 function RevolutionaryLayout() {
  const [news, setNews] = useState<News[]>([])

  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
      if (error) {
        console.error("Error al cargar noticias:", error)
      } else {
        console.log("Noticias cargadas:", data)
        setNews(data || [])
      }
    }
    fetchNews()
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}>
      <Canvas shadows camera={{ position: [0, 2, 7], fov: 50 }}> {/* Ajusté la posición inicial de la cámara */}
        <color attach="background" args={['#000015']} />
        <fog attach="fog" args={['#000015', 5, 20]} />
        <Environment preset="city" />
        <BroadcastStudioSet />
        <BroadcastSystem news={news} />
        {/* Controles de cámara para depuración */}
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
export default RevolutionaryLayout