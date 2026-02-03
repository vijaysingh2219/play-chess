import { Metadata } from 'next';

export const generatePageMetadata = (
  title: string,
  description: string,
  options?: {
    ogImage?: string;
    noindex?: boolean;
  },
): Metadata => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://play-chess.gg';
  const ogImage = options?.ogImage || '/og-image.png';
  const formattedTitle = `${title} | Play Chess`;

  return {
    title: formattedTitle,
    description,
    robots: {
      index: !options?.noindex,
      follow: true,
    },
    openGraph: {
      title: formattedTitle,
      description,
      url: baseUrl,
      siteName: 'play-chess',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: formattedTitle,
      description,
      images: [ogImage],
    },
  };
};

// Page-specific metadata
export const pageMetadata = {
  home: {
    title: 'Home',
    description:
      'Play chess online for free with friends and players around the world. Enjoy real-time and turn-based games and improve your skills.',
  },
  profile: {
    title: 'Profile',
    description: 'View and edit your profile information.',
  },
  settings: {
    general: {
      title: 'General Settings',
      description: 'Update your general account settings and preferences.',
    },
    security: {
      title: 'Security Settings',
      description: 'Manage your account security, passwords, and sessions.',
    },
    activity: {
      title: 'Activity',
      description: 'View your account activity and login history.',
    },
  },
  auth: {
    signIn: {
      title: 'Sign In',
      description: 'Sign in to your play-chess account.',
    },
    signUp: {
      title: 'Sign Up',
      description: 'Create a new play-chess account.',
    },
    forgotPassword: {
      title: 'Forgot Password',
      description: 'Reset your password.',
    },
    resetPassword: {
      title: 'Reset Password',
      description: 'Create a new password for your account.',
    },
    twoFactor: {
      title: 'Two-Factor Authentication',
      description: 'Enter your two-factor authentication code to verify your identity.',
    },
  },
  goodbye: {
    title: 'Account Deleted',
    description: 'Your account has been successfully deleted.',
  },
  notFound: {
    title: '404 - Page Not Found',
    description: 'The page you are looking for could not be found.',
  },
  error: {
    title: 'Error',
    description: 'An error occurred while processing your request.',
  },
  membership: {
    title: 'Improve Your Chess with a Premium Membership',
    description: 'Unlock premium features, and enhance your chess experience with a membership.',
  },
  leaderboard: {
    title: 'Chess Leaderboard and Rankings',
    description:
      'Check the top players, view rankings, and see who is leading in real-time chess matches.',
  },
  games: {
    title: 'Games History',
    description:
      'View your past chess games, analyze moves, replay matches, and track your progress over time.',
  },
  game: {
    title: 'Play Chess Online',
    description:
      'Watch or replay Chess Game, analyze moves, and track match details in real-time or later.',
  },
  friends: {
    title: 'Friends',
    description:
      'Connect with friends, challenge them to real-time chess games, and track your matches.',
  },
  play: {
    online: {
      title: 'Play Chess Online',
      description:
        'Play chess games online in real-time with friends or other players around the world.',
    },
  },
};
