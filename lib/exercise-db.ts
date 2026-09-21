// Catálogo único de ejercicios (fusiona el antiguo `exercises-data`).
export interface ExerciseDBItem {
  id: string
  name: string
  bodyPart: string
  equipment: string
  gifUrl: string
  target: string
  secondaryMuscles: string[]
  /** ID de YouTube con la demostración (solo algunos ejercicios lo tienen). */
  videoId?: string
}

// Body parts for filtering
export const bodyParts = [
  "Glúteos",
  "Cuádriceps",
  "Espalda",
  "Pectoral",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Core",
  "Isquiotibiales",
  "Piernas",
  "Cardio",
  "Cuerpo completo"
] as const

// Equipment types for filtering
export const equipmentTypes = [
  "Barra",
  "Mancuernas",
  "Máquina",
  "Kettlebell",
  "Banda Elástica",
  "Peso Corporal",
  "Cable",
  "Barra Smith",
  "Barra Olímpica",
  "Remadora",
  "Cuerda"
] as const

export const exerciseDatabase: ExerciseDBItem[] = [
  // --- Tu equipo (migrado del catálogo original): Smith, remadora, cuerda, elásticos… ---
  {
    id: "smith-squat",
    name: "Sentadilla Smith",
    bodyPart: "Piernas",
    equipment: "Barra Smith",
    gifUrl: "https://img.youtube.com/vi/aclHkVaku9U/0.jpg",
    target: "Piernas",
    secondaryMuscles: [],
    videoId: "aclHkVaku9U"
  },
  {
    id: "smith-bench",
    name: "Press Banca Smith",
    bodyPart: "Pectoral",
    equipment: "Barra Smith",
    gifUrl: "https://img.youtube.com/vi/gRVjAtPip0Y/0.jpg",
    target: "Pecho",
    secondaryMuscles: [],
    videoId: "gRVjAtPip0Y"
  },
  {
    id: "smith-shoulder",
    name: "Press Militar Smith",
    bodyPart: "Hombros",
    equipment: "Barra Smith",
    gifUrl: "https://img.youtube.com/vi/vqJMpX3RAmY/0.jpg",
    target: "Hombros",
    secondaryMuscles: [],
    videoId: "vqJMpX3RAmY"
  },
  {
    id: "smith-lunge",
    name: "Zancadas Smith",
    bodyPart: "Piernas",
    equipment: "Barra Smith",
    gifUrl: "https://img.youtube.com/vi/GWUB6Rp0tQ8/0.jpg",
    target: "Piernas",
    secondaryMuscles: [],
    videoId: "GWUB6Rp0tQ8"
  },
  {
    id: "db-curl",
    name: "Curl Bíceps",
    bodyPart: "Bíceps",
    equipment: "Mancuernas",
    gifUrl: "https://img.youtube.com/vi/ykJmrZ5v0Oo/0.jpg",
    target: "Bíceps",
    secondaryMuscles: [],
    videoId: "ykJmrZ5v0Oo"
  },
  {
    id: "db-shoulder-press",
    name: "Press Hombro",
    bodyPart: "Hombros",
    equipment: "Mancuernas",
    gifUrl: "https://img.youtube.com/vi/qEwKCR5JCog/0.jpg",
    target: "Hombros",
    secondaryMuscles: [],
    videoId: "qEwKCR5JCog"
  },
  {
    id: "db-lateral-raise",
    name: "Elevaciones Laterales",
    bodyPart: "Hombros",
    equipment: "Mancuernas",
    gifUrl: "https://img.youtube.com/vi/3VcKaXpzqRo/0.jpg",
    target: "Hombros",
    secondaryMuscles: [],
    videoId: "3VcKaXpzqRo"
  },
  {
    id: "db-row",
    name: "Remo con Mancuerna",
    bodyPart: "Espalda",
    equipment: "Mancuernas",
    gifUrl: "https://img.youtube.com/vi/pYcpY20QaE8/0.jpg",
    target: "Espalda",
    secondaryMuscles: [],
    videoId: "pYcpY20QaE8"
  },
  {
    id: "db-fly",
    name: "Aperturas Pecho",
    bodyPart: "Pectoral",
    equipment: "Mancuernas",
    gifUrl: "https://img.youtube.com/vi/eozdVDA78K0/0.jpg",
    target: "Pecho",
    secondaryMuscles: [],
    videoId: "eozdVDA78K0"
  },
  {
    id: "rowing-intervals",
    name: "Intervalos Remo",
    bodyPart: "Cuerpo completo",
    equipment: "Remadora",
    gifUrl: "https://img.youtube.com/vi/H0r-Bqzq3iE/0.jpg",
    target: "Full Body",
    secondaryMuscles: [],
    videoId: "H0r-Bqzq3iE"
  },
  {
    id: "rowing-steady",
    name: "Remo Constante",
    bodyPart: "Cardio",
    equipment: "Remadora",
    gifUrl: "https://img.youtube.com/vi/zQ82RYIFLN8/0.jpg",
    target: "Cardio",
    secondaryMuscles: [],
    videoId: "zQ82RYIFLN8"
  },
  {
    id: "rowing-pyramid",
    name: "Pirámide Remo",
    bodyPart: "Cuerpo completo",
    equipment: "Remadora",
    gifUrl: "https://img.youtube.com/vi/4zWu1yuJ0_g/0.jpg",
    target: "Full Body",
    secondaryMuscles: [],
    videoId: "4zWu1yuJ0_g"
  },
  {
    id: "band-pull-apart",
    name: "Pull Apart",
    bodyPart: "Espalda",
    equipment: "Banda Elástica",
    gifUrl: "https://img.youtube.com/vi/JObYtU7Y7ag/0.jpg",
    target: "Espalda",
    secondaryMuscles: [],
    videoId: "JObYtU7Y7ag"
  },
  {
    id: "band-face-pull",
    name: "Face Pull",
    bodyPart: "Hombros",
    equipment: "Banda Elástica",
    gifUrl: "https://img.youtube.com/vi/rep-qVOkqgk/0.jpg",
    target: "Hombros",
    secondaryMuscles: [],
    videoId: "rep-qVOkqgk"
  },
  {
    id: "band-squat",
    name: "Sentadilla con Banda",
    bodyPart: "Piernas",
    equipment: "Banda Elástica",
    gifUrl: "https://img.youtube.com/vi/tNs6Ln2kPrA/0.jpg",
    target: "Piernas",
    secondaryMuscles: [],
    videoId: "tNs6Ln2kPrA"
  },
  {
    id: "deadlift",
    name: "Peso Muerto",
    bodyPart: "Espalda",
    equipment: "Barra Olímpica",
    gifUrl: "https://img.youtube.com/vi/op9kVnSso6Q/0.jpg",
    target: "Espalda/Piernas",
    secondaryMuscles: [],
    videoId: "op9kVnSso6Q"
  },
  {
    id: "squat",
    name: "Sentadilla Profunda",
    bodyPart: "Piernas",
    equipment: "Barra Olímpica",
    gifUrl: "https://img.youtube.com/vi/bEv6CCg2BC8/0.jpg",
    target: "Piernas",
    secondaryMuscles: [],
    videoId: "bEv6CCg2BC8"
  },
  {
    id: "bench-press",
    name: "Press de Banca",
    bodyPart: "Pectoral",
    equipment: "Barra Olímpica",
    gifUrl: "https://img.youtube.com/vi/rT7DgCr-3pg/0.jpg",
    target: "Pecho",
    secondaryMuscles: [],
    videoId: "rT7DgCr-3pg"
  },
  {
    id: "clean",
    name: "Clean",
    bodyPart: "Cuerpo completo",
    equipment: "Barra Olímpica",
    gifUrl: "https://img.youtube.com/vi/EKRiW9Yt3Ps/0.jpg",
    target: "Full Body",
    secondaryMuscles: [],
    videoId: "EKRiW9Yt3Ps"
  },
  {
    id: "kb-swing",
    name: "Kettlebell Swing",
    bodyPart: "Cuerpo completo",
    equipment: "Kettlebell",
    gifUrl: "https://img.youtube.com/vi/YSxHifyI6s8/0.jpg",
    target: "Full Body",
    secondaryMuscles: [],
    videoId: "YSxHifyI6s8"
  },
  {
    id: "kb-goblet-squat",
    name: "Goblet Squat",
    bodyPart: "Piernas",
    equipment: "Kettlebell",
    gifUrl: "https://img.youtube.com/vi/MeIiIdhvXT4/0.jpg",
    target: "Piernas",
    secondaryMuscles: [],
    videoId: "MeIiIdhvXT4"
  },
  {
    id: "kb-turkish",
    name: "Turkish Get-Up",
    bodyPart: "Core",
    equipment: "Kettlebell",
    gifUrl: "https://img.youtube.com/vi/0bWRPC6gdvY/0.jpg",
    target: "Core",
    secondaryMuscles: [],
    videoId: "0bWRPC6gdvY"
  },
  {
    id: "rope-double-under",
    name: "Double Unders",
    bodyPart: "Cardio",
    equipment: "Cuerda",
    gifUrl: "https://img.youtube.com/vi/82jNjDS19lg/0.jpg",
    target: "Cardio",
    secondaryMuscles: [],
    videoId: "82jNjDS19lg"
  },
  {
    id: "rope-single",
    name: "Saltos Simples",
    bodyPart: "Cardio",
    equipment: "Cuerda",
    gifUrl: "https://img.youtube.com/vi/u3zgHI8QnqE/0.jpg",
    target: "Cardio",
    secondaryMuscles: [],
    videoId: "u3zgHI8QnqE"
  },
  {
    id: "bw-pullup",
    name: "Dominadas",
    bodyPart: "Espalda",
    equipment: "Peso Corporal",
    gifUrl: "https://img.youtube.com/vi/eGo4IYlbE5g/0.jpg",
    target: "Espalda",
    secondaryMuscles: [],
    videoId: "eGo4IYlbE5g"
  },
  {
    id: "bw-pushup",
    name: "Flexiones",
    bodyPart: "Pectoral",
    equipment: "Peso Corporal",
    gifUrl: "https://img.youtube.com/vi/IODxDxX7oi4/0.jpg",
    target: "Pecho",
    secondaryMuscles: [],
    videoId: "IODxDxX7oi4"
  },
  {
    id: "bw-burpee",
    name: "Burpees",
    bodyPart: "Cuerpo completo",
    equipment: "Peso Corporal",
    gifUrl: "https://img.youtube.com/vi/dZgVxmf6jkA/0.jpg",
    target: "Full Body",
    secondaryMuscles: [],
    videoId: "dZgVxmf6jkA"
  },

  // --- Biblioteca general ---
  // Glúteos exercises
  {
    id: "ex-001",
    name: "Hip Thrust con Barra",
    bodyPart: "Glúteos",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=400&fit=crop",
    target: "Glúteo Mayor",
    secondaryMuscles: ["Isquiotibiales", "Core"]
  },
  {
    id: "ex-002",
    name: "Sentadilla Sumo",
    bodyPart: "Glúteos",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&h=400&fit=crop",
    target: "Glúteo Mayor",
    secondaryMuscles: ["Cuádriceps", "Aductores"]
  },
  {
    id: "ex-003",
    name: "Patada de Glúteo en Máquina",
    bodyPart: "Glúteos",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&h=400&fit=crop",
    target: "Glúteo Mayor",
    secondaryMuscles: ["Isquiotibiales"]
  },
  {
    id: "ex-004",
    name: "Puente de Glúteos",
    bodyPart: "Glúteos",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop",
    target: "Glúteo Mayor",
    secondaryMuscles: ["Core", "Isquiotibiales"]
  },
  // Cuádriceps exercises
  {
    id: "ex-005",
    name: "Sentadilla Frontal",
    bodyPart: "Cuádriceps",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1567598508481-65985588e295?w=400&h=400&fit=crop",
    target: "Cuádriceps",
    secondaryMuscles: ["Glúteos", "Core"]
  },
  {
    id: "ex-006",
    name: "Prensa de Piernas",
    bodyPart: "Cuádriceps",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
    target: "Cuádriceps",
    secondaryMuscles: ["Glúteos", "Isquiotibiales"]
  },
  {
    id: "ex-007",
    name: "Extensión de Cuádriceps",
    bodyPart: "Cuádriceps",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&h=400&fit=crop",
    target: "Cuádriceps",
    secondaryMuscles: []
  },
  {
    id: "ex-008",
    name: "Zancadas con Mancuernas",
    bodyPart: "Cuádriceps",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&h=400&fit=crop",
    target: "Cuádriceps",
    secondaryMuscles: ["Glúteos", "Isquiotibiales"]
  },
  {
    id: "ex-009",
    name: "Goblet Squat",
    bodyPart: "Cuádriceps",
    equipment: "Kettlebell",
    gifUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&h=400&fit=crop",
    target: "Cuádriceps",
    secondaryMuscles: ["Glúteos", "Core"]
  },
  // Espalda exercises
  {
    id: "ex-010",
    name: "Peso Muerto Convencional",
    bodyPart: "Espalda",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Isquiotibiales", "Glúteos", "Trapecios"]
  },
  {
    id: "ex-011",
    name: "Remo con Barra",
    bodyPart: "Espalda",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Bíceps", "Romboides"]
  },
  {
    id: "ex-012",
    name: "Remo con Mancuerna",
    bodyPart: "Espalda",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Bíceps", "Core"]
  },
  {
    id: "ex-013",
    name: "Jalón al Pecho",
    bodyPart: "Espalda",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Bíceps", "Romboides"]
  },
  {
    id: "ex-014",
    name: "Dominadas",
    bodyPart: "Espalda",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Bíceps", "Core"]
  },
  {
    id: "ex-015",
    name: "Remo en Máquina",
    bodyPart: "Espalda",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&h=400&fit=crop",
    target: "Dorsal",
    secondaryMuscles: ["Bíceps", "Romboides"]
  },
  // Pectoral exercises
  {
    id: "ex-016",
    name: "Press de Banca",
    bodyPart: "Pectoral",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1571388208497-71bedc66e932?w=400&h=400&fit=crop",
    target: "Pectoral Mayor",
    secondaryMuscles: ["Tríceps", "Hombros"]
  },
  {
    id: "ex-017",
    name: "Press Inclinado con Mancuernas",
    bodyPart: "Pectoral",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=400&h=400&fit=crop",
    target: "Pectoral Superior",
    secondaryMuscles: ["Tríceps", "Hombros"]
  },
  {
    id: "ex-018",
    name: "Aperturas con Mancuernas",
    bodyPart: "Pectoral",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1597347343908-2937e7dcc560?w=400&h=400&fit=crop",
    target: "Pectoral Mayor",
    secondaryMuscles: ["Hombros"]
  },
  {
    id: "ex-019",
    name: "Press en Máquina",
    bodyPart: "Pectoral",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=400&h=400&fit=crop",
    target: "Pectoral Mayor",
    secondaryMuscles: ["Tríceps", "Hombros"]
  },
  {
    id: "ex-020",
    name: "Flexiones",
    bodyPart: "Pectoral",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&h=400&fit=crop",
    target: "Pectoral Mayor",
    secondaryMuscles: ["Tríceps", "Core"]
  },
  {
    id: "ex-021",
    name: "Cruce de Cables",
    bodyPart: "Pectoral",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop",
    target: "Pectoral Mayor",
    secondaryMuscles: ["Hombros"]
  },
  // Hombros exercises
  {
    id: "ex-022",
    name: "Press Militar",
    bodyPart: "Hombros",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?w=400&h=400&fit=crop",
    target: "Deltoides Anterior",
    secondaryMuscles: ["Tríceps", "Core"]
  },
  {
    id: "ex-023",
    name: "Elevaciones Laterales",
    bodyPart: "Hombros",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&h=400&fit=crop",
    target: "Deltoides Lateral",
    secondaryMuscles: []
  },
  {
    id: "ex-024",
    name: "Elevaciones Frontales",
    bodyPart: "Hombros",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1584466977773-e625c37cdd50?w=400&h=400&fit=crop",
    target: "Deltoides Anterior",
    secondaryMuscles: []
  },
  {
    id: "ex-025",
    name: "Face Pull",
    bodyPart: "Hombros",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop",
    target: "Deltoides Posterior",
    secondaryMuscles: ["Trapecios", "Romboides"]
  },
  {
    id: "ex-026",
    name: "Press Arnold",
    bodyPart: "Hombros",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=400&fit=crop",
    target: "Deltoides",
    secondaryMuscles: ["Tríceps"]
  },
  // Bíceps exercises
  {
    id: "ex-027",
    name: "Curl con Barra",
    bodyPart: "Bíceps",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&h=400&fit=crop",
    target: "Bíceps",
    secondaryMuscles: ["Antebrazo"]
  },
  {
    id: "ex-028",
    name: "Curl con Mancuernas",
    bodyPart: "Bíceps",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=400&fit=crop",
    target: "Bíceps",
    secondaryMuscles: ["Antebrazo"]
  },
  {
    id: "ex-029",
    name: "Curl Martillo",
    bodyPart: "Bíceps",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=400&h=400&fit=crop",
    target: "Braquial",
    secondaryMuscles: ["Bíceps", "Antebrazo"]
  },
  {
    id: "ex-030",
    name: "Curl en Polea",
    bodyPart: "Bíceps",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1534368959876-26bf04f2c947?w=400&h=400&fit=crop",
    target: "Bíceps",
    secondaryMuscles: ["Antebrazo"]
  },
  // Tríceps exercises
  {
    id: "ex-031",
    name: "Press Francés",
    bodyPart: "Tríceps",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1597347343908-2937e7dcc560?w=400&h=400&fit=crop",
    target: "Tríceps",
    secondaryMuscles: []
  },
  {
    id: "ex-032",
    name: "Extensión de Tríceps",
    bodyPart: "Tríceps",
    equipment: "Mancuernas",
    gifUrl: "https://images.unsplash.com/photo-1571388208497-71bedc66e932?w=400&h=400&fit=crop",
    target: "Tríceps",
    secondaryMuscles: []
  },
  {
    id: "ex-033",
    name: "Jalón de Tríceps",
    bodyPart: "Tríceps",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&h=400&fit=crop",
    target: "Tríceps",
    secondaryMuscles: []
  },
  {
    id: "ex-034",
    name: "Fondos",
    bodyPart: "Tríceps",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&h=400&fit=crop",
    target: "Tríceps",
    secondaryMuscles: ["Pectoral", "Hombros"]
  },
  // Core exercises
  {
    id: "ex-035",
    name: "Plancha",
    bodyPart: "Core",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&h=400&fit=crop",
    target: "Core",
    secondaryMuscles: ["Hombros", "Glúteos"]
  },
  {
    id: "ex-036",
    name: "Russian Twist",
    bodyPart: "Core",
    equipment: "Kettlebell",
    gifUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop",
    target: "Oblicuos",
    secondaryMuscles: ["Recto Abdominal"]
  },
  {
    id: "ex-037",
    name: "Crunch en Polea",
    bodyPart: "Core",
    equipment: "Cable",
    gifUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop",
    target: "Recto Abdominal",
    secondaryMuscles: []
  },
  {
    id: "ex-038",
    name: "Swing con Kettlebell",
    bodyPart: "Core",
    equipment: "Kettlebell",
    gifUrl: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=400&h=400&fit=crop",
    target: "Core",
    secondaryMuscles: ["Glúteos", "Isquiotibiales"]
  },
  // Isquiotibiales exercises
  {
    id: "ex-039",
    name: "Peso Muerto Rumano",
    bodyPart: "Isquiotibiales",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
    target: "Isquiotibiales",
    secondaryMuscles: ["Glúteos", "Espalda Baja"]
  },
  {
    id: "ex-040",
    name: "Curl de Piernas",
    bodyPart: "Isquiotibiales",
    equipment: "Máquina",
    gifUrl: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&h=400&fit=crop",
    target: "Isquiotibiales",
    secondaryMuscles: []
  },
  {
    id: "ex-041",
    name: "Buenos Días",
    bodyPart: "Isquiotibiales",
    equipment: "Barra",
    gifUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=400&fit=crop",
    target: "Isquiotibiales",
    secondaryMuscles: ["Glúteos", "Espalda Baja"]
  },
  {
    id: "ex-042",
    name: "Nordic Curl",
    bodyPart: "Isquiotibiales",
    equipment: "Peso Corporal",
    gifUrl: "https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400&h=400&fit=crop",
    target: "Isquiotibiales",
    secondaryMuscles: ["Glúteos"]
  }
]
