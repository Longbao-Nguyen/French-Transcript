import { SampleAudio } from '../types';

export const SAMPLE_AUDIO_LIST: SampleAudio[] = [
  {
    id: 'sorbonne-eco-cours',
    title: 'Cours d\'Économie - Université Paris 1 Panthéon-Sorbonne',
    description: 'Bài giảng Kinh tế Vi mô & Chính sách Công (20 phút / 10 đoạn 120s)',
    durationSec: 1200, // 20 mins -> 10 segments of 120s
    segmentsCount: 10,
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=french-lecture-sample.mp3',
    segments: [
      {
        startSec: 0,
        endSec: 120,
        text: 'Bonjour à toutes et à tous. Bienvenue dans cette première séance consacrée aux fondements de la politique macroéconomique contemporaine. Nous allons examiner aujourd\'hui comment les banques centrales européennes articulent leurs décisions face aux tensions inflationnistes et aux impératifs de la transition écologique.'
      },
      {
        startSec: 120,
        endSec: 240,
        text: 'Pour comprendre la portée de ces mécanismes, il convient d\'abord de revenir sur les théorèmes néo-classiques du marché des capitaux. Comme l\'indiquait Jean-Paul Fitoussi, l\'équilibre n\'est pas un point statique, mais une dynamique perpétuelle régulée par les anticipations des ménages et des entreprises.'
      },
      {
        startSec: 240,
        endSec: 360,
        text: 'Regardez le graphique projeté sur l\'amphithéâtre. L\'élasticité de la demande par rapport au niveau général des prix montre une divergence notable entre les biens de première nécessité et les biens manufacturés dans la zone euro au cours du dernier trimestre.'
      },
      {
        startSec: 360,
        endSec: 480,
        text: 'Ce constat nous amène à la question de l\'efficacité des stimuli budgétaires. Dans le contexte de l\'Union européenne, le pacte de stabilité et de croissance impose des contraintes institutionnelles rigoureuses qui obligent les États membres à concilier souveraineté nationale et discipline collective.'
      },
      {
        startSec: 480,
        endSec: 600,
        text: 'Nous devons également aborder la notion de multiplicateur keynésien dans une économie ouverte. Lorsque le commerce extérieur représente plus de 30 % du produit intérieur brut, une part significative de la relance par la dépense publique fuit vers les importations étrangères.'
      },
      {
        startSec: 600,
        endSec: 720,
        text: 'Passons maintenant au deuxième chapitre de notre séance : la courbe de Phillips et ses révisions successives. Les données empiriques collectées en France et en Allemagne entre 1995 et 2020 révèlent un aplatissement progressif de la relation entre chômage et accélération des salaires.'
      },
      {
        startSec: 720,
        endSec: 840,
        text: 'Pourquoi ce phénomène s\'est-il produit ? Plusieurs économistes mettent en avant la mondialisation des chaînes de valeur, l\'affaiblissement du pouvoir de négociation syndicale, ainsi que la digitalisation des tâches de service dans le secteur tertiaire.'
      },
      {
        startSec: 840,
        endSec: 960,
        text: 'Il est fondamental pour vos examens de partiel de savoir synthétiser ces deux approches divergentes. D\'un côté, l\'école de Chicago insiste sur la neutralité de la monnaie à long terme ; de l\'autre, les néo-keynésiens soulignent les rigidités nominales persistantes.'
      },
      {
        startSec: 960,
        endSec: 1080,
        text: 'Avant de conclure cette analyse, prenons quelques minutes pour examiner les implications de la régulation bancaire prudentielle, notamment les accords de Bâle III et les exigences de fonds propres appliquées aux établissements de crédit systémiques.'
      },
      {
        startSec: 1080,
        endSec: 1200,
        text: 'En résumé, nous constatons que la résilience du modèle européen dépendra de sa capacité à combiner une fiscalité incitative et des investissements ciblés dans l\'innovation technologique. Je vous invite à consulter les lectures obligatoires sur l\'espace numérique de travail. À la semaine prochaine.'
      }
    ]
  },
  {
    id: 'sorbonne-droit-cours',
    title: 'Droit Administratif & Institutions - Université de Lyon',
    description: 'Bài giảng Droit administratif và Quyền lực nhà nước (12 phút / 6 đoạn 120s)',
    durationSec: 720,
    segmentsCount: 6,
    url: 'https://example.com/audio/droit-administratif.mp3',
    segments: [
      {
        startSec: 0,
        endSec: 120,
        text: 'Mes chers étudiants, nous reprenons notre cours sur le principe de légalité en droit administratif français. Il s\'agit de la pierre angulaire de tout notre système juridique républicain depuis l\'arrêt Blanco de 1873 rendu par le Tribunal des conflits.'
      },
      {
        startSec: 120,
        endSec: 240,
        text: 'La hiérarchie des normes théorisée par Hans Kelsen s\'applique avec une rigueur absolue : les actes administratifs unilatéraux doivent impérativement respecter la loi votée par le Parlement, les traités internationaux ratifiés, et au sommet, les principes constitutionnels.'
      },
      {
        startSec: 240,
        endSec: 360,
        text: 'Lorsque le Conseil d\'État est saisi d\'un recours pour excès de pouvoir, son contrôle peut être soit restreint à l\'erreur manifeste d\'appréciation, soit approfondi jusqu\'au contrôle de proportionnalité, conformément à la célèbre jurisprudence Benjamin de 1933.'
      },
      {
        startSec: 360,
        endSec: 480,
        text: 'La liberté de réunion et la liberté d\'expression constituent des libertés fondamentales que l\'autorité de police ne peut restreindre que si le maintien de l\'ordre public ne peut être assuré par des mesures moins contraignantes.'
      },
      {
        startSec: 480,
        endSec: 600,
        text: 'Nous observerons également la distinction essentielle entre police administrative générale et police administrative spéciale, notamment en matière environnementale et d\'urbanisme, où le législateur a confié des prérogatives accrues aux préfets et aux maires.'
      },
      {
        startSec: 600,
        endSec: 720,
        text: 'Pour le prochain travail dirigé, vous aurez à rédiger un commentaire d\'arrêt portant sur la responsabilité sans faute de l\'État du fait des lois. Pensez à bien structurer votre fiche d\'arrêt en dégageant clairement le problème juridique et les prétentions des parties.'
      }
    ]
  }
];
