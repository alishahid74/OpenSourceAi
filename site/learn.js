"use strict";

// "Learn to prompt": five habits with a weak and a better prompt each, a library of ready-made prompts,
// and Anthropic's open-source pieces. "Try it" opens chat.html with the prompt typed in (chat.html?prompt=...).
// The page text lives in i18n.js; the lessons and prompts are longer, so they live here, per language.

const LESSONS = {
  en: [
    { title: "Be specific", weak: "Write about dogs.", better: "Write 3 short tips for a first-time owner of a puppy that lives in a small flat.", why: "Say who it's for, how long it should be and what it's for. The AI can't guess what's in your head." },
    { title: "Give an example", weak: "Suggest a name for my tea shop.", better: "Suggest 5 names for my tea shop. I like names in this style: Leaf & Lane, Steep Street.", why: "One or two examples show the style you want faster than any description." },
    { title: "Ask for a format", weak: "Compare cats and dogs as pets.", better: "Compare cats and dogs as pets in a table with rows for cost, time needed and space needed.", why: "Ask for a table, a list or a length, and you get something you can use straight away." },
    { title: "Give it a role", weak: "Check my CV.", better: "You are a hiring manager for junior web developers. Point out the 3 weakest parts of my CV and how to fix them:\n\n[paste your CV]", why: "A role tells the AI which knowledge and tone to use." },
    { title: "Ask for the steps", weak: "How much paint do I need?", better: "My room is 4 m by 3 m with walls 2.5 m high. One litre of paint covers 10 m². Work out step by step how many litres I need for two coats.", why: "For sums and logic, asking for the steps makes the AI much less likely to guess, especially small models." },
  ],
  es: [
    { title: "Sé concreto", weak: "Escribe sobre perros.", better: "Escribe 3 consejos breves para alguien que tiene su primer cachorro y vive en un piso pequeño.", why: "Di para quién es, qué extensión debe tener y para qué sirve. La IA no puede adivinar lo que tienes en la cabeza." },
    { title: "Da un ejemplo", weak: "Sugiere un nombre para mi tienda de té.", better: "Sugiere 5 nombres para mi tienda de té. Me gustan los nombres de este estilo: Hoja y Camino, Calle Infusión.", why: "Uno o dos ejemplos muestran el estilo que quieres más rápido que cualquier descripción." },
    { title: "Pide un formato", weak: "Compara perros y gatos como mascotas.", better: "Compara perros y gatos como mascotas en una tabla con filas para el costo, el tiempo necesario y el espacio necesario.", why: "Pide una tabla, una lista o una extensión y obtendrás algo que puedes usar enseguida." },
    { title: "Dale un papel", weak: "Revisa mi currículum.", better: "Eres responsable de contratación de desarrolladores web junior. Señala las 3 partes más débiles de mi currículum y cómo mejorarlas:\n\n[pega tu currículum]", why: "Un papel le dice a la IA qué conocimientos y qué tono usar." },
    { title: "Pide los pasos", weak: "¿Cuánta pintura necesito?", better: "Mi habitación mide 4 m por 3 m y las paredes tienen 2,5 m de alto. Un litro de pintura cubre 10 m². Calcula paso a paso cuántos litros necesito para dos manos.", why: "En cuentas y razonamientos, pedir los pasos hace que la IA adivine mucho menos, sobre todo los modelos pequeños." },
  ],
  fr: [
    { title: "Soyez précis", weak: "Écris sur les chiens.", better: "Écris 3 conseils courts pour quelqu'un qui adopte son premier chiot et vit dans un petit appartement.", why: "Dites pour qui c'est, quelle longueur et à quoi ça sert. L'IA ne peut pas deviner ce que vous avez en tête." },
    { title: "Donnez un exemple", weak: "Propose un nom pour mon salon de thé.", better: "Propose 5 noms pour mon salon de thé. J'aime les noms dans ce style : Feuille & Ruelle, Rue de l'Infusion.", why: "Un ou deux exemples montrent le style voulu plus vite que n'importe quelle description." },
    { title: "Demandez un format", weak: "Compare les chats et les chiens comme animaux de compagnie.", better: "Compare les chats et les chiens comme animaux de compagnie dans un tableau avec des lignes pour le coût, le temps nécessaire et l'espace nécessaire.", why: "Demandez un tableau, une liste ou une longueur, et vous obtenez quelque chose d'utilisable tout de suite." },
    { title: "Donnez-lui un rôle", weak: "Vérifie mon CV.", better: "Tu es recruteur pour des développeurs web débutants. Indique les 3 points les plus faibles de mon CV et comment les corriger :\n\n[collez votre CV]", why: "Un rôle indique à l'IA quelles connaissances et quel ton utiliser." },
    { title: "Demandez les étapes", weak: "Combien de peinture me faut-il ?", better: "Ma chambre fait 4 m sur 3 m avec des murs de 2,5 m de haut. Un litre de peinture couvre 10 m². Calcule étape par étape combien de litres il me faut pour deux couches.", why: "Pour les calculs et la logique, demander les étapes rend l'IA bien moins susceptible de deviner, surtout les petits modèles." },
  ],
  pt: [
    { title: "Seja específico", weak: "Escreva sobre cachorros.", better: "Escreva 3 dicas curtas para quem vai ter o primeiro filhote e mora em um apartamento pequeno.", why: "Diga para quem é, qual o tamanho e para que serve. A IA não consegue adivinhar o que está na sua cabeça." },
    { title: "Dê um exemplo", weak: "Sugira um nome para minha casa de chá.", better: "Sugira 5 nomes para minha casa de chá. Gosto de nomes neste estilo: Folha & Viela, Rua da Infusão.", why: "Um ou dois exemplos mostram o estilo que você quer mais rápido do que qualquer descrição." },
    { title: "Peça um formato", weak: "Compare gatos e cachorros como bichos de estimação.", better: "Compare gatos e cachorros como bichos de estimação em uma tabela com linhas para custo, tempo necessário e espaço necessário.", why: "Peça uma tabela, uma lista ou um tamanho e você recebe algo que pode usar na hora." },
    { title: "Dê um papel", weak: "Revise meu currículo.", better: "Você é recrutador de desenvolvedores web júnior. Aponte as 3 partes mais fracas do meu currículo e como melhorá-las:\n\n[cole seu currículo]", why: "Um papel diz à IA qual conhecimento e qual tom usar." },
    { title: "Peça os passos", weak: "Quanta tinta eu preciso?", better: "Meu quarto tem 4 m por 3 m e paredes de 2,5 m de altura. Um litro de tinta cobre 10 m². Calcule passo a passo quantos litros preciso para duas demãos.", why: "Em contas e raciocínios, pedir os passos faz a IA chutar bem menos, principalmente os modelos pequenos." },
  ],
  ar: [
    { title: "كن محددًا", weak: "اكتب عن الكلاب.", better: "اكتب 3 نصائح قصيرة لشخص يقتني جروه الأول ويعيش في شقة صغيرة.", why: "قل لمن هو، وما طوله، ولأي غرض. لا يستطيع الذكاء الاصطناعي تخمين ما في رأسك." },
    { title: "أعطِ مثالًا", weak: "اقترح اسمًا لمحل الشاي الخاص بي.", better: "اقترح 5 أسماء لمحل الشاي الخاص بي. تعجبني الأسماء بهذا الأسلوب: ورقة وزقاق، شارع النقيع.", why: "مثال أو مثالان يُظهران الأسلوب الذي تريده أسرع من أي وصف." },
    { title: "اطلب شكلًا محددًا", weak: "قارن بين القطط والكلاب كحيوانات أليفة.", better: "قارن بين القطط والكلاب كحيوانات أليفة في جدول فيه صفوف للتكلفة والوقت اللازم والمساحة اللازمة.", why: "اطلب جدولًا أو قائمة أو طولًا محددًا، فتحصل على شيء تستخدمه فورًا." },
    { title: "أعطه دورًا", weak: "راجع سيرتي الذاتية.", better: "أنت مسؤول توظيف لمطوري الويب المبتدئين. حدّد أضعف 3 أجزاء في سيرتي الذاتية وكيف أحسّنها:\n\n[الصق سيرتك الذاتية]", why: "الدور يخبر الذكاء الاصطناعي بالمعرفة والنبرة المناسبتين." },
    { title: "اطلب الخطوات", weak: "كم أحتاج من الطلاء؟", better: "غرفتي 4 م × 3 م وارتفاع الجدران 2.5 م. لتر الطلاء يغطي 10 م². احسب خطوة بخطوة كم لترًا أحتاج لطبقتين.", why: "في الحساب والمنطق، طلب الخطوات يقلّل التخمين كثيرًا، خصوصًا في النماذج الصغيرة." },
  ],
  ur: [
    { title: "واضح بات کریں", weak: "کتوں کے بارے میں لکھیں۔", better: "پہلی بار پلّا پالنے والے کے لیے 3 مختصر مشورے لکھیں جو ایک چھوٹے فلیٹ میں رہتا ہے۔", why: "بتائیں یہ کس کے لیے ہے، کتنا لمبا ہو اور کس کام کا ہے۔ AI آپ کے ذہن کی بات کا اندازہ نہیں لگا سکتا۔" },
    { title: "مثال دیں", weak: "میری چائے کی دکان کا نام تجویز کریں۔", better: "میری چائے کی دکان کے لیے 5 نام تجویز کریں۔ مجھے اس انداز کے نام پسند ہیں: پتی اور گلی، دم کی سڑک۔", why: "ایک دو مثالیں آپ کا پسندیدہ انداز کسی بھی وضاحت سے جلدی دکھا دیتی ہیں۔" },
    { title: "شکل بتائیں", weak: "بلیوں اور کتوں کا بطور پالتو موازنہ کریں۔", better: "بلیوں اور کتوں کا بطور پالتو ایک جدول میں موازنہ کریں جس میں خرچ، درکار وقت اور درکار جگہ کی قطاریں ہوں۔", why: "جدول، فہرست یا لمبائی مانگیں تو ایسا جواب ملتا ہے جو فوراً کام آئے۔" },
    { title: "کردار دیں", weak: "میری سی وی دیکھیں۔", better: "آپ جونیئر ویب ڈویلپرز کی بھرتی کرنے والے مینیجر ہیں۔ میری سی وی کے 3 کمزور ترین حصے بتائیں اور انہیں بہتر کرنے کا طریقہ بھی:\n\n[اپنی سی وی یہاں پیسٹ کریں]", why: "کردار AI کو بتاتا ہے کہ کون سا علم اور لہجہ استعمال کرے۔" },
    { title: "مرحلہ وار پوچھیں", weak: "مجھے کتنا پینٹ چاہیے؟", better: "میرا کمرہ 4 میٹر × 3 میٹر ہے اور دیواریں 2.5 میٹر اونچی ہیں۔ ایک لیٹر پینٹ 10 مربع میٹر ڈھانپتا ہے۔ مرحلہ وار حساب لگائیں کہ دو کوٹ کے لیے کتنے لیٹر چاہئیں۔", why: "حساب اور منطق میں مرحلے مانگنے سے AI بہت کم اندازے لگاتا ہے، خاص طور پر چھوٹے ماڈل۔" },
  ],
  hi: [
    { title: "साफ़-साफ़ बताएँ", weak: "कुत्तों के बारे में लिखो।", better: "पहली बार पिल्ला पालने वाले के लिए 3 छोटी सलाह लिखो, जो एक छोटे फ़्लैट में रहता है।", why: "बताएँ कि यह किसके लिए है, कितना लंबा हो और किस काम का है। AI आपके मन की बात का अंदाज़ा नहीं लगा सकता।" },
    { title: "उदाहरण दें", weak: "मेरी चाय की दुकान का नाम सुझाओ।", better: "मेरी चाय की दुकान के लिए 5 नाम सुझाओ। मुझे इस तरह के नाम पसंद हैं: पत्ती और गली, चुस्की मार्ग।", why: "एक-दो उदाहरण आपकी पसंद का अंदाज़ किसी भी विवरण से जल्दी दिखा देते हैं।" },
    { title: "रूप बताएँ", weak: "पालतू जानवर के रूप में बिल्ली और कुत्ते की तुलना करो।", better: "पालतू जानवर के रूप में बिल्ली और कुत्ते की तुलना एक टेबल में करो, जिसमें खर्च, लगने वाला समय और जगह की पंक्तियाँ हों।", why: "टेबल, सूची या लंबाई माँगें, तो ऐसा जवाब मिलता है जो तुरंत काम आए।" },
    { title: "भूमिका दें", weak: "मेरा CV देखो।", better: "तुम जूनियर वेब डेवलपर्स की भर्ती करने वाले मैनेजर हो। मेरे CV के 3 सबसे कमज़ोर हिस्से बताओ और उन्हें सुधारने का तरीका भी:\n\n[अपना CV यहाँ पेस्ट करें]", why: "भूमिका AI को बताती है कि कौन-सा ज्ञान और लहजा इस्तेमाल करे।" },
    { title: "चरण माँगें", weak: "मुझे कितना पेंट चाहिए?", better: "मेरा कमरा 4 मीटर × 3 मीटर है और दीवारें 2.5 मीटर ऊँची हैं। एक लीटर पेंट 10 वर्ग मीटर ढकता है। चरण-दर-चरण हिसाब लगाओ कि दो कोट के लिए कितने लीटर चाहिए।", why: "हिसाब और तर्क में चरण माँगने से AI बहुत कम अंदाज़ा लगाता है, ख़ासकर छोटे मॉडल।" },
  ],
  zh: [
    { title: "说具体", weak: "写写关于狗的内容。", better: "给第一次养小狗、住在小公寓里的人写 3 条简短建议。", why: "说清楚写给谁、写多长、用来做什么。AI 猜不到你脑子里在想什么。" },
    { title: "给个例子", weak: "给我的茶馆起个名字。", better: "给我的茶馆起 5 个名字。我喜欢这种风格的名字：叶巷、慢泡街。", why: "一两个例子比任何描述都更快地说明你想要的风格。" },
    { title: "指定格式", weak: "比较一下猫和狗作为宠物。", better: "用表格比较猫和狗作为宠物，行分别是花费、需要的时间和需要的空间。", why: "要求表格、列表或字数，你就能得到马上能用的结果。" },
    { title: "给它一个角色", weak: "帮我看看简历。", better: "你是招聘初级网页开发者的招聘经理。指出我简历中最弱的 3 个部分以及如何改进：\n\n[粘贴你的简历]", why: "角色告诉 AI 该用什么知识和语气。" },
    { title: "要求分步骤", weak: "我需要多少油漆？", better: "我的房间长 4 米、宽 3 米，墙高 2.5 米。一升油漆能刷 10 平方米。请一步一步算出刷两遍需要多少升。", why: "做计算和推理时，要求写出步骤能让 AI 少很多瞎猜，小模型尤其如此。" },
  ],
};

const PROMPTS = {
  en: [
    ["Summarize a text", "Summarize this in 5 bullet points for a busy reader:\n\n[paste the text]"],
    ["Write a polite email", "Write a short, friendly email to my landlord asking them to fix the heating this week. Keep it under 100 words."],
    ["Study helper", "Explain photosynthesis to a 12-year-old in simple words, then ask me 3 quiz questions, one at a time."],
    ["Explain code", "Explain what this code does, step by step, in plain words:\n\n[paste the code]"],
    ["Translate naturally", "Translate this into natural, friendly Spanish, the way a native speaker would say it:\n\n[paste the text]"],
    ["Plan a trip", "Plan a relaxed 2-day trip to Lisbon for two people on a small budget. Give a morning, afternoon and evening plan for each day."],
    ["Cook with what I have", "I have rice, eggs, onions and frozen peas. Suggest 2 simple dinners I can cook in 30 minutes, with steps."],
    ["Improve my writing", "Make this text clearer and friendlier, but keep my meaning. Then list what you changed:\n\n[paste your text]"],
    ["Practise an interview", "Act as an interviewer for a customer service job. Ask me one question at a time and give short feedback after each answer."],
    ["Meeting notes to tasks", "Turn these meeting notes into a list of decisions and a list of tasks, with who does each:\n\n[paste the notes]"],
  ],
  es: [
    ["Resumir un texto", "Resume esto en 5 viñetas para alguien con poco tiempo:\n\n[pega el texto]"],
    ["Escribir un correo amable", "Escribe un correo breve y amable a mi casero pidiéndole que arregle la calefacción esta semana. Menos de 100 palabras."],
    ["Ayuda para estudiar", "Explica la fotosíntesis a un niño de 12 años con palabras sencillas y luego hazme 3 preguntas de repaso, una a una."],
    ["Explicar código", "Explica paso a paso y con palabras sencillas qué hace este código:\n\n[pega el código]"],
    ["Traducir con naturalidad", "Traduce esto a un inglés natural y cercano, como lo diría un hablante nativo:\n\n[pega el texto]"],
    ["Planear un viaje", "Planea un viaje tranquilo de 2 días a Lisboa para dos personas con poco presupuesto. Da un plan de mañana, tarde y noche para cada día."],
    ["Cocinar con lo que tengo", "Tengo arroz, huevos, cebollas y guisantes congelados. Sugiere 2 cenas sencillas que pueda hacer en 30 minutos, con los pasos."],
    ["Mejorar mi texto", "Haz este texto más claro y amable, pero conserva lo que quiero decir. Luego enumera lo que cambiaste:\n\n[pega tu texto]"],
    ["Practicar una entrevista", "Haz de entrevistador para un puesto de atención al cliente. Hazme una pregunta cada vez y dame un comentario breve tras cada respuesta."],
    ["De notas de reunión a tareas", "Convierte estas notas de reunión en una lista de decisiones y una lista de tareas con quién hace cada una:\n\n[pega las notas]"],
  ],
  fr: [
    ["Résumer un texte", "Résume ceci en 5 points pour un lecteur pressé :\n\n[collez le texte]"],
    ["Écrire un e-mail poli", "Écris un e-mail court et aimable à mon propriétaire pour lui demander de réparer le chauffage cette semaine. Moins de 100 mots."],
    ["Aide aux devoirs", "Explique la photosynthèse à un enfant de 12 ans avec des mots simples, puis pose-moi 3 questions de révision, une par une."],
    ["Expliquer du code", "Explique étape par étape, avec des mots simples, ce que fait ce code :\n\n[collez le code]"],
    ["Traduire naturellement", "Traduis ceci en anglais naturel et chaleureux, comme le dirait une personne de langue maternelle :\n\n[collez le texte]"],
    ["Préparer un voyage", "Prépare un voyage tranquille de 2 jours à Lisbonne pour deux personnes avec un petit budget. Donne un programme matin, après-midi et soir pour chaque jour."],
    ["Cuisiner avec ce que j'ai", "J'ai du riz, des œufs, des oignons et des petits pois surgelés. Propose 2 dîners simples à faire en 30 minutes, avec les étapes."],
    ["Améliorer mon texte", "Rends ce texte plus clair et plus aimable sans changer ce que je veux dire. Puis liste ce que tu as modifié :\n\n[collez votre texte]"],
    ["S'entraîner à un entretien", "Joue le rôle d'un recruteur pour un poste au service client. Pose-moi une question à la fois et donne un bref retour après chaque réponse."],
    ["Des notes de réunion aux tâches", "Transforme ces notes de réunion en une liste de décisions et une liste de tâches, avec qui fait quoi :\n\n[collez les notes]"],
  ],
  pt: [
    ["Resumir um texto", "Resuma isto em 5 tópicos para alguém com pouco tempo:\n\n[cole o texto]"],
    ["Escrever um e-mail educado", "Escreva um e-mail curto e simpático ao meu senhorio pedindo que conserte o aquecimento esta semana. Menos de 100 palavras."],
    ["Ajuda nos estudos", "Explique a fotossíntese para uma criança de 12 anos com palavras simples e depois me faça 3 perguntas de revisão, uma de cada vez."],
    ["Explicar código", "Explique passo a passo, com palavras simples, o que este código faz:\n\n[cole o código]"],
    ["Traduzir com naturalidade", "Traduza isto para um inglês natural e simpático, como um falante nativo diria:\n\n[cole o texto]"],
    ["Planejar uma viagem", "Planeje uma viagem tranquila de 2 dias a Lisboa para duas pessoas com pouco dinheiro. Dê um plano de manhã, tarde e noite para cada dia."],
    ["Cozinhar com o que tenho", "Tenho arroz, ovos, cebola e ervilhas congeladas. Sugira 2 jantares simples que eu faça em 30 minutos, com o passo a passo."],
    ["Melhorar meu texto", "Deixe este texto mais claro e simpático, mas mantenha o que eu quero dizer. Depois liste o que você mudou:\n\n[cole seu texto]"],
    ["Treinar uma entrevista", "Faça o papel de entrevistador para uma vaga de atendimento ao cliente. Faça uma pergunta por vez e dê um retorno curto depois de cada resposta."],
    ["De anotações de reunião a tarefas", "Transforme estas anotações de reunião em uma lista de decisões e uma lista de tarefas, com quem faz cada uma:\n\n[cole as anotações]"],
  ],
  ar: [
    ["لخّص نصًا", "لخّص هذا في 5 نقاط لقارئ مشغول:\n\n[الصق النص]"],
    ["اكتب رسالة لطيفة", "اكتب رسالة بريد قصيرة ولطيفة إلى المالك أطلب فيها إصلاح التدفئة هذا الأسبوع. أقل من 100 كلمة."],
    ["مساعد للدراسة", "اشرح عملية البناء الضوئي لطفل عمره 12 سنة بكلمات بسيطة، ثم اطرح عليّ 3 أسئلة مراجعة واحدًا تلو الآخر."],
    ["اشرح شيفرة برمجية", "اشرح خطوة بخطوة وبكلمات بسيطة ما تفعله هذه الشيفرة:\n\n[الصق الشيفرة]"],
    ["ترجمة طبيعية", "ترجم هذا إلى إنجليزية طبيعية وودودة كما يقولها متحدث أصلي:\n\n[الصق النص]"],
    ["خطّط لرحلة", "خطّط لرحلة هادئة لمدة يومين إلى لشبونة لشخصين بميزانية صغيرة. ضع خطة للصباح والظهر والمساء لكل يوم."],
    ["اطبخ بما لديّ", "لديّ أرز وبيض وبصل وبازلاء مجمدة. اقترح وجبتي عشاء بسيطتين أطبخهما في 30 دقيقة، مع الخطوات."],
    ["حسّن كتابتي", "اجعل هذا النص أوضح وألطف مع الحفاظ على معناه، ثم اذكر ما غيّرته:\n\n[الصق نصك]"],
    ["تدرّب على مقابلة عمل", "تقمّص دور من يجري مقابلة لوظيفة خدمة العملاء. اسألني سؤالًا واحدًا في كل مرة وأعطني ملاحظة قصيرة بعد كل إجابة."],
    ["من ملاحظات اجتماع إلى مهام", "حوّل ملاحظات الاجتماع هذه إلى قائمة بالقرارات وقائمة بالمهام مع ذكر المسؤول عن كل مهمة:\n\n[الصق الملاحظات]"],
  ],
  ur: [
    ["متن کا خلاصہ", "اس کا خلاصہ مصروف قاری کے لیے 5 نکات میں کریں:\n\n[متن یہاں پیسٹ کریں]"],
    ["شائستہ ای میل لکھیں", "مالک مکان کو ایک مختصر اور دوستانہ ای میل لکھیں کہ اس ہفتے ہیٹنگ ٹھیک کروا دیں۔ 100 الفاظ سے کم۔"],
    ["پڑھائی میں مدد", "12 سال کے بچے کو آسان الفاظ میں ضیائی تالیف (فوٹو سنتھیسس) سمجھائیں، پھر مجھ سے ایک ایک کر کے 3 سوال پوچھیں۔"],
    ["کوڈ سمجھائیں", "آسان الفاظ میں مرحلہ وار بتائیں کہ یہ کوڈ کیا کرتا ہے:\n\n[کوڈ یہاں پیسٹ کریں]"],
    ["فطری ترجمہ", "اس کا ترجمہ فطری اور دوستانہ انگریزی میں کریں، جیسے کوئی اہلِ زبان کہے:\n\n[متن یہاں پیسٹ کریں]"],
    ["سفر کا منصوبہ", "دو لوگوں کے لیے کم بجٹ میں لزبن کے 2 دن کے آرام دہ سفر کا منصوبہ بنائیں۔ ہر دن کے لیے صبح، دوپہر اور شام کا پروگرام دیں۔"],
    ["جو ہے اسی سے کھانا", "میرے پاس چاول، انڈے، پیاز اور فروزن مٹر ہیں۔ 30 منٹ میں بننے والے 2 آسان کھانے طریقے کے ساتھ بتائیں۔"],
    ["میری تحریر بہتر کریں", "اس تحریر کو زیادہ واضح اور دوستانہ بنائیں مگر مطلب وہی رہے۔ پھر بتائیں کیا بدلا:\n\n[اپنی تحریر یہاں پیسٹ کریں]"],
    ["انٹرویو کی مشق", "کسٹمر سروس کی نوکری کے انٹرویو لینے والے بنیں۔ ایک وقت میں ایک سوال پوچھیں اور ہر جواب کے بعد مختصر رائے دیں۔"],
    ["میٹنگ نوٹس سے کام", "ان میٹنگ نوٹس کو فیصلوں کی فہرست اور کاموں کی فہرست میں بدلیں، ہر کام کس کا ہے یہ بھی لکھیں:\n\n[نوٹس یہاں پیسٹ کریں]"],
  ],
  hi: [
    ["टेक्स्ट का सार", "व्यस्त पाठक के लिए इसका सार 5 बिंदुओं में लिखो:\n\n[टेक्स्ट यहाँ पेस्ट करें]"],
    ["विनम्र ईमेल लिखें", "मकान मालिक को एक छोटा और दोस्ताना ईमेल लिखो कि इस हफ़्ते हीटिंग ठीक करवा दें। 100 शब्दों से कम।"],
    ["पढ़ाई में मदद", "12 साल के बच्चे को आसान शब्दों में प्रकाश संश्लेषण समझाओ, फिर मुझसे एक-एक करके 3 सवाल पूछो।"],
    ["कोड समझाएँ", "आसान शब्दों में चरण-दर-चरण बताओ कि यह कोड क्या करता है:\n\n[कोड यहाँ पेस्ट करें]"],
    ["स्वाभाविक अनुवाद", "इसका अनुवाद स्वाभाविक और दोस्ताना अंग्रेज़ी में करो, जैसे कोई मूल वक्ता कहे:\n\n[टेक्स्ट यहाँ पेस्ट करें]"],
    ["यात्रा की योजना", "दो लोगों के लिए कम बजट में लिस्बन की 2 दिन की आरामदायक यात्रा की योजना बनाओ। हर दिन के लिए सुबह, दोपहर और शाम का प्लान दो।"],
    ["जो है उसी से खाना", "मेरे पास चावल, अंडे, प्याज़ और फ्रोज़न मटर हैं। 30 मिनट में बनने वाले 2 आसान डिनर तरीके के साथ बताओ।"],
    ["मेरा लेखन सुधारें", "इस टेक्स्ट को ज़्यादा साफ़ और दोस्ताना बनाओ, पर मतलब वही रहे। फिर बताओ क्या बदला:\n\n[अपना टेक्स्ट यहाँ पेस्ट करें]"],
    ["इंटरव्यू की प्रैक्टिस", "कस्टमर सर्विस की नौकरी के इंटरव्यूअर बनो। एक बार में एक सवाल पूछो और हर जवाब के बाद छोटी राय दो।"],
    ["मीटिंग नोट्स से काम", "इन मीटिंग नोट्स को फ़ैसलों की सूची और कामों की सूची में बदलो, हर काम किसका है यह भी लिखो:\n\n[नोट्स यहाँ पेस्ट करें]"],
  ],
  zh: [
    ["总结一段文字", "把这段内容总结成 5 个要点，给没时间细看的人：\n\n[粘贴文字]"],
    ["写一封礼貌的邮件", "给房东写一封简短友好的邮件，请他这周修好暖气。不超过 100 字。"],
    ["学习助手", "用简单的话给 12 岁的孩子讲解光合作用，然后一次一个地问我 3 道复习题。"],
    ["解释代码", "用通俗的话一步一步解释这段代码做了什么：\n\n[粘贴代码]"],
    ["自然地翻译", "把这段话翻译成自然、亲切的英语，就像母语者会说的那样：\n\n[粘贴文字]"],
    ["规划旅行", "为两个人规划一次预算不多、节奏轻松的里斯本 2 日游。每天分上午、下午和晚上安排。"],
    ["用现有食材做饭", "我有米饭、鸡蛋、洋葱和冷冻豌豆。推荐 2 道 30 分钟能做好的简单晚餐，并写出步骤。"],
    ["润色我的文字", "让这段文字更清楚、更友好，但保持原意。然后列出你改了哪些地方：\n\n[粘贴你的文字]"],
    ["模拟面试", "扮演客服岗位的面试官。每次只问我一个问题，并在我每次回答后给出简短反馈。"],
    ["把会议记录变成任务", "把这些会议记录整理成一份决定清单和一份任务清单，并写明每项任务由谁负责：\n\n[粘贴会议记录]"],
  ],
};

// Anthropic's open-source pieces. Links are the official pages.
const CLAUDE_LINKS = [
  "https://github.com/anthropics/skills",
  "https://modelcontextprotocol.io",
  "https://github.com/anthropics/prompt-eng-interactive-tutorial",
];
const CLAUDE = {
  en: [
    ["Agent Skills", "Folders of instructions and files that teach an AI agent a task, like making a spreadsheet or following a style guide. The format and example skills are published openly."],
    ["Model Context Protocol (MCP)", "An open standard for connecting AI apps to tools and data, such as files, calendars or databases. Many open models and apps support it too."],
    ["Free prompting course", "Anthropic's interactive prompt engineering tutorial, free on GitHub. Most lessons work with any AI, including the open models here."],
  ],
  es: [
    ["Agent Skills", "Carpetas con instrucciones y archivos que enseñan una tarea a un agente de IA, como crear una hoja de cálculo o seguir una guía de estilo. El formato y los ejemplos son públicos."],
    ["Model Context Protocol (MCP)", "Un estándar abierto para conectar apps de IA con herramientas y datos, como archivos, calendarios o bases de datos. Muchos modelos y apps abiertos también lo usan."],
    ["Curso gratuito de prompts", "El tutorial interactivo de Anthropic sobre cómo escribir prompts, gratis en GitHub. La mayoría de las lecciones sirven para cualquier IA, incluidos los modelos abiertos de aquí."],
  ],
  fr: [
    ["Agent Skills", "Des dossiers d'instructions et de fichiers qui apprennent une tâche à un agent IA, comme créer un tableur ou suivre une charte. Le format et des exemples sont publiés ouvertement."],
    ["Model Context Protocol (MCP)", "Un standard ouvert pour relier les applications d'IA à des outils et des données : fichiers, agendas, bases de données. Beaucoup de modèles et d'applications ouverts le prennent en charge."],
    ["Cours gratuit de prompts", "Le tutoriel interactif d'Anthropic pour bien rédiger ses prompts, gratuit sur GitHub. La plupart des leçons valent pour toute IA, y compris les modèles ouverts d'ici."],
  ],
  pt: [
    ["Agent Skills", "Pastas com instruções e arquivos que ensinam uma tarefa a um agente de IA, como criar uma planilha ou seguir um guia de estilo. O formato e os exemplos são públicos."],
    ["Model Context Protocol (MCP)", "Um padrão aberto para ligar apps de IA a ferramentas e dados, como arquivos, agendas ou bancos de dados. Muitos modelos e apps abertos também o usam."],
    ["Curso grátis de prompts", "O tutorial interativo da Anthropic sobre como escrever prompts, grátis no GitHub. A maioria das lições serve para qualquer IA, inclusive os modelos abertos daqui."],
  ],
  ar: [
    ["Agent Skills", "مجلدات من التعليمات والملفات تعلّم وكيل الذكاء الاصطناعي مهمة ما، مثل إنشاء جدول بيانات أو اتباع دليل أسلوب. الصيغة والأمثلة منشورة بشكل مفتوح."],
    ["Model Context Protocol (MCP)", "معيار مفتوح لربط تطبيقات الذكاء الاصطناعي بالأدوات والبيانات، مثل الملفات والتقويمات وقواعد البيانات. تدعمه كثير من النماذج والتطبيقات المفتوحة أيضًا."],
    ["دورة مجانية في كتابة الأوامر", "درس Anthropic التفاعلي في كتابة الأوامر، مجاني على GitHub. معظم الدروس تنفع مع أي ذكاء اصطناعي، ومنها النماذج المفتوحة هنا."],
  ],
  ur: [
    ["Agent Skills", "ہدایات اور فائلوں کے فولڈر جو AI ایجنٹ کو کوئی کام سکھاتے ہیں، جیسے اسپریڈشیٹ بنانا یا کسی اسٹائل گائیڈ پر چلنا۔ اس کا فارمیٹ اور مثالیں کھلے عام شائع ہیں۔"],
    ["Model Context Protocol (MCP)", "AI ایپس کو ٹولز اور ڈیٹا، جیسے فائلوں، کیلنڈر یا ڈیٹا بیس سے جوڑنے کا ایک کھلا معیار۔ کئی اوپن ماڈل اور ایپس بھی اسے استعمال کرتے ہیں۔"],
    ["پرامپٹ لکھنے کا مفت کورس", "پرامپٹ لکھنے پر Anthropic کا انٹرایکٹو سبق، GitHub پر مفت۔ زیادہ تر اسباق ہر AI کے ساتھ کام آتے ہیں، یہاں کے اوپن ماڈلز سمیت۔"],
  ],
  hi: [
    ["Agent Skills", "निर्देशों और फ़ाइलों के फ़ोल्डर जो AI एजेंट को कोई काम सिखाते हैं, जैसे स्प्रेडशीट बनाना या किसी स्टाइल गाइड का पालन करना। इसका फ़ॉर्मैट और उदाहरण खुले तौर पर प्रकाशित हैं।"],
    ["Model Context Protocol (MCP)", "AI ऐप्स को टूल और डेटा, जैसे फ़ाइलों, कैलेंडर या डेटाबेस से जोड़ने का एक खुला मानक। कई ओपन मॉडल और ऐप भी इसे इस्तेमाल करते हैं।"],
    ["प्रॉम्प्ट लिखने का मुफ़्त कोर्स", "प्रॉम्प्ट लिखने पर Anthropic का इंटरैक्टिव ट्यूटोरियल, GitHub पर मुफ़्त। ज़्यादातर पाठ किसी भी AI के साथ काम आते हैं, यहाँ के ओपन मॉडल समेत।"],
  ],
  zh: [
    ["Agent Skills", "由指令和文件组成的文件夹，用来教 AI 智能体完成某项任务，比如制作电子表格或遵循写作规范。其格式和示例都已公开发布。"],
    ["Model Context Protocol (MCP)", "一个开放标准，用来把 AI 应用连接到文件、日历、数据库等工具和数据。许多开源模型和应用也支持它。"],
    ["免费提示词课程", "Anthropic 的交互式提示词教程，在 GitHub 上免费提供。大部分内容适用于任何 AI，包括本站的开源模型。"],
  ],
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const chatLink = (prompt) => `chat.html?lang=${LANG}&prompt=${encodeURIComponent(prompt)}`;

let lesson = 0;

function renderLessons() {
  const list = LESSONS[LANG] || LESSONS.en;
  $("lessonTabs").innerHTML = list.map((l, i) =>
    `<button type="button" class="chip" aria-pressed="${i === lesson}" data-lesson="${i}">${num(i + 1)}. ${esc(l.title)}</button>`).join("");
  const l = list[lesson];
  $("lesson").innerHTML = `
    <h3>${esc(l.title)}</h3>
    <div class="lesson-pair">
      <div class="lesson-box weak"><span class="lesson-label">✕ ${esc(t("learn.weak"))}</span><p dir="auto">${esc(l.weak)}</p></div>
      <div class="lesson-box better"><span class="lesson-label">✓ ${esc(t("learn.better"))}</span><p dir="auto">${esc(l.better)}</p></div>
    </div>
    <p class="lesson-why">${esc(l.why)}</p>
    <a class="btn primary" href="${esc(chatLink(l.better))}">${esc(t("learn.try"))}</a>`;
}

function renderPrompts() {
  const list = PROMPTS[LANG] || PROMPTS.en;
  $("prompts").innerHTML = list.map(([title, text], i) => `
    <article class="prompt-card">
      <h3>${esc(title)}</h3>
      <p dir="auto">${esc(text)}</p>
      <div class="prompt-actions">
        <a class="btn primary small" href="${esc(chatLink(text))}">${esc(t("learn.tryShort"))}</a>
        <button type="button" class="btn ghost small" data-copy-prompt="${i}">${esc(t("learn.copy"))}</button>
      </div>
    </article>`).join("");
}

function renderClaude() {
  const list = CLAUDE[LANG] || CLAUDE.en;
  $("claudeCards").innerHTML = list.map(([title, text], i) => `
    <a class="home-card" href="${CLAUDE_LINKS[i]}" target="_blank" rel="noopener">
      <b dir="ltr">${esc(title)} ↗</b><span>${esc(text)}</span>
    </a>`).join("");
}

function render() {
  applyI18n();
  renderLessons();
  renderPrompts();
  renderClaude();
}

LANG = detectLang();
render();
$("lang").addEventListener("change", (ev) => { chooseLang(ev.target.value); render(); });
$("lessonTabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-lesson]");
  if (!b) return;
  lesson = +b.dataset.lesson;
  renderLessons();
});
$("prompts").addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-copy-prompt]");
  if (!b) return;
  const [, text] = (PROMPTS[LANG] || PROMPTS.en)[+b.dataset.copyPrompt];
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = t("learn.copied");
  } catch {
    b.textContent = t("learn.copyFailed");
  }
  setTimeout(() => { b.textContent = t("learn.copy"); }, 2000);
});
