'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxvdnfaeqjifnxqmxbri.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc'
const supabase = createClient(supabaseUrl, supabaseKey)

interface News {
  id: string
  title: string
  content: string
  category?: string
  image_url?: string
  published_at: string
}

// Cámara que se mueve
function CamaraMovil({ indice }: { indice: number }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())

  useEffect(() => {
    const posiciones = [
      { cam: [0, 2.5, 7], look: [0, 2, 0] },
      { cam: [-3, 2.5, 6], look: [-1.5, 2, 0] },
      { cam: [3, 2.5, 6], look: [1.5, 2, 0] },
      { cam: [0, 3.5, 6], look: [0, 2.5, 0] },
    ]
    const pos = posiciones[indice % posiciones.length]
    target.current.set(pos.cam[0], pos.cam[1], pos.cam[2])
    lookAt.current.set(pos.look[0], pos.look[1], pos.look[2])
  }, [indice])

  useFrame(() => {
    camera.position.lerp(target.current, 0.05)
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.multiplyScalar(10).add(camera.position)
    dir.lerp(lookAt.current, 0.05)
    camera.lookAt(dir)
  })

  return null
}

// Set del estudio
function SetEstudio() {
  return (
    <group>
      {/* Piso brillante */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[25, 25]} />
        <meshStandardMaterial 
          color="#3a3a6e" 
          metalness={0.9} 
          roughness={0.1}
          emissive="#1a1a4e"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Pared fondo */}
      <mesh position={[0, 4, -4]}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial 
          color="#2a2a5e" 
          emissive="#1a1a4e"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Barras de neon verticales */}
      {[-5, -2.5, 2.5, 5].map((x, i) => (
        <mesh key={i} position={[x, 4, -3.8]}>
          <boxGeometry args={[0.2, 8, 0.1]} />
          <meshStandardMaterial 
            color="#00ffff" 
            emissive="#00ffff"
            emissiveIntensity={2}
          />
        </mesh>
      ))}

      {/* Escritorio */}
      <mesh position={[0, 1.2, 1.5]}>
        <boxGeometry args={[2.5, 0.15, 1.2]} />
        <meshStandardMaterial 
          color="#4a4a9e" 
          metalness={0.8}
          roughness={0.2}
          emissive="#2a2a7e"
          emissiveIntensity={0.4}
        />
      </mesh>
      <mesh position={[0, 0.6, 1.5]}>
        <boxGeometry args={[2.3, 1.1, 1.1]} />
        <meshStandardMaterial color="#3a3a8e" />
      </mesh>

      {/* Luces del techo */}
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.5]} />
        <meshStandardMaterial 
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3}
        />
      </mesh>
      <mesh position={[-3, 6.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.4]} />
        <meshStandardMaterial 
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={3}
        />
      </mesh>
      <mesh position={[3, 6.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.4]} />
        <meshStandardMaterial 
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  )
}

// Pantalla con imagen y título
function PantallaConImagen({ 
  position, 
  rotation = [0, 0, 0],
  imageUrl,
  titulo,
  size = [3, 2]
}: any) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (imageUrl) {
      const loader = new THREE.TextureLoader()
      loader.load(
        imageUrl,
        (texture) => setTex(texture),
        undefined,
        () => setTex(null)
      )
    }
  }, [imageUrl])

  return (
    <group position={position} rotation={rotation}>
      {/* Marco */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[size[0] + 0.15, size[1] + 0.15, 0.08]} />
        <meshStandardMaterial 
          color="#1a1a3e" 
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Pantalla */}
      <mesh>
        <planeGeometry args={size} />
        {tex ? (
          <meshStandardMaterial 
            map={tex}
            emissive="#ffffff"
            emissiveIntensity={0.4}
          />
        ) : (
          <meshStandardMaterial 
            color="#2a2a5e"
            emissive="#00ffff"
            emissiveIntensity={0.3}
          />
        )}
      </mesh>

      {/* Título arriba */}
      <Text
        position={[0, size[1] / 2 + 0.25, 0.01]}
        fontSize={0.12}
        color="#00ffff"
        font="https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff"
        anchorX="center"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {titulo}
      </Text>

      {/* Borde luminoso */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size[0], size[1])]} />
        <lineBasicMaterial color="#00ffff" linewidth={2} />
      </lineSegments>
    </group>
  )
}

// Avatar presentador
function Avatar({ hablando }: { hablando: boolean }) {
  const cabezaRef = useRef<THREE.Mesh>(null!)
  
  useFrame(({ clock }) => {
    if (hablando && cabezaRef.current) {
      const t = clock.getElapsedTime()
      cabezaRef.current.rotation.y = Math.sin(t * 3) * 0.06
    }
  })

  return (
    <group position={[0, 1.2, 1.5]}>
      {/* Cabeza */}
      <mesh ref={cabezaRef} position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#ffd4a3" />
      </mesh>

      {/* Ojos */}
      <mesh position={[-0.07, 0.93, 0.19]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#000" />
      </mesh>
      <mesh position={[0.07, 0.93, 0.19]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#000" />
      </mesh>

      {/* Cuello */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.12]} />
        <meshStandardMaterial color="#ffd4a3" />
      </mesh>

      {/* Traje */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.7, 32]} />
        <meshStandardMaterial color="#1a1a3e" />
      </mesh>

      {/* Camisa */}
      <mesh position={[0, 0.45, 0.23]}>
        <boxGeometry args={[0.35, 0.4, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Corbata */}
      <mesh position={[0, 0.42, 0.26]}>
        <boxGeometry args={[0.07, 0.35, 0.02]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>

      {/* Brazos */}
      <mesh position={[-0.35, 0.25, 0]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.055, 0.055, 0.5]} />
        <meshStandardMaterial color="#1a1a3e" />
      </mesh>
      <mesh position={[0.35, 0.25, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.055, 0.055, 0.5]} />
        <meshStandardMaterial color="#1a1a3e" />
      </mesh>
    </group>
  )
}

// Sistema completo
function SistemaCompleto({ news }: { news: News[] }) {
  const [indice, setIndice] = useState(0)
  const [hablando, setHablando] = useState(false)

  useEffect(() => {
    if (!news.length) return
    
    const noticia = news[indice]
    const texto = `${noticia.category || 'Noticia'}. ${noticia.title}. ${noticia.content.substring(0, 150)}`
    
    const voz = new SpeechSynthesisUtterance(texto)
    voz.lang = 'es-CO'
    voz.rate = 1
    voz.pitch = 1
    
    voz.onstart = () => setHablando(true)
    voz.onend = () => {
      setHablando(false)
      setTimeout(() => setIndice(i => (i + 1) % news.length), 3500)
    }
    
    window.speechSynthesis.speak(voz)
    
    return () => window.speechSynthesis.cancel()
  }, [indice, news])

  if (!news.length) return null

  return (
    <>
      <CamaraMovil indice={indice} />
      
      {/* Pantalla principal */}
      <PantallaConImagen
        position={[0, 3.5, -2.5]}
        imageUrl={news[indice].image_url}
        titulo={news[indice].category || 'BREAKING NEWS'}
        size={[4.5, 2.8]}
      />

      {/* Pantallas laterales */}
      <PantallaConImagen
        position={[-3.5, 2.5, -2]}
        rotation={[0, 0.25, 0]}
        imageUrl={news[(indice + 1) % news.length]?.image_url}
        titulo="PRÓXIMA"
        size={[2.2, 1.5]}
      />
      <PantallaConImagen
        position={[3.5, 2.5, -2]}
        rotation={[0, -0.25, 0]}
        imageUrl={news[(indice + 2) % news.length]?.image_url}
        titulo="ÚLTIMA HORA"
        size={[2.2, 1.5]}
      />

      {/* Pantallas pequeñas arriba */}
      <PantallaConImagen
        position={[-2.5, 5.5, -2.5]}
        imageUrl={news[(indice + 3) % news.length]?.image_url}
        titulo="EN VIVO"
        size={[1.3, 0.9]}
      />
      <PantallaConImagen
        position={[2.5, 5.5, -2.5]}
        imageUrl={news[(indice + 4) % news.length]?.image_url}
        titulo="AHORA"
        size={[1.3, 0.9]}
      />

      <Avatar hablando={hablando} />

      {/* Info noticia actual */}
      <Html position={[0, 6.5, 0]} center>
        <motion.div
          key={indice}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/90 backdrop-blur-xl px-8 py-4 rounded-xl border-2 border-cyan-400 w-[550px]"
        >
          <h2 className="text-white text-xl font-bold mb-2">
            {news[indice].title}
          </h2>
          <p className="text-gray-300 text-sm">
            {news[indice].content.substring(0, 120)}...
          </p>
        </motion.div>
      </Html>
    </>
  )
}

function Ticker({ titulos }: { titulos: string[] }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-black via-red-900/40 to-black py-3 border-t-2 border-red-500">
      <motion.div
        animate={{ x: ['100%', '-100%'] }}
        transition={{ repeat: Infinity, duration: 35, ease: 'linear' }}
        className="whitespace-nowrap text-white text-base font-bold"
      >
        {titulos.map((t, i) => (
          <span key={i} className="mx-10">🔴 {t}</span>
        ))}
      </motion.div>
    </div>
  )
}

function Header() {
  const [hora, setHora] = useState('')

  useEffect(() => {
    const actualizar = () => {
      setHora(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }))
    }
    actualizar()
    const timer = setInterval(actualizar, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <div className="w-14 h-14 bg-red-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-2xl font-bold">N</span>
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold">NEXUS NEWS</h1>
          <p className="text-red-400 text-xs font-semibold">Breaking News 24/7</p>
        </div>
      </div>

      <div className="absolute top-6 right-6 bg-black/90 px-5 py-2 rounded-lg border-2 border-red-500">
        <p className="text-red-400 text-xs font-bold">EN VIVO</p>
        <p className="text-white text-xl font-bold">{hora}</p>
      </div>
    </>
  )
}

export default function NoticieroEstiloCNN() {
  const [noticias, setNoticias] = useState<News[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10)
      if (data) setNoticias(data as News[])
    })()
  }, [])

  return (
    <div className="w-screen h-screen bg-black">
      <Canvas>
        <color attach="background" args={['#0a0a1a']} />
        
        <ambientLight intensity={1.5} />
        <directionalLight position={[0, 10, 10]} intensity={2.5} color="#ffffff" />
        <directionalLight position={[-6, 5, 5]} intensity={2} color="#00ffff" />
        <directionalLight position={[6, 5, 5]} intensity={2} color="#ff00ff" />
        <pointLight position={[0, 5, 5]} intensity={2} color="#ffffff" />
        <pointLight position={[-4, 3, 3]} intensity={1.5} color="#00ffff" />
        <pointLight position={[4, 3, 3]} intensity={1.5} color="#ff00ff" />
        
        <SetEstudio />
        {noticias.length > 0 && <SistemaCompleto news={noticias} />}
      </Canvas>

      <Header />
      {noticias.length > 0 && <Ticker titulos={noticias.map(n => n.title)} />}
    </div>
  )
}