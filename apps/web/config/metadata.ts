import { Metadata } from 'next';
import {
  BASE_URL,
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  formatSiteTitle,
  toAbsoluteUrl,
} from './site-shared';

export const generatePageMetadata = (
  title: string,
  description: string,
  options?: {
    ogImage?: string;
    noindex?: boolean;
  },
): Metadata => {
  const ogImage = toAbsoluteUrl(options?.ogImage ?? DEFAULT_OG_IMAGE);
  const formattedTitle = formatSiteTitle(title);

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
      url: BASE_URL,
      siteName: SITE_NAME,
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
    title: 'Play Chess Online for Free with Friends & Players Worldwide',
    description: SITE_DESCRIPTION,
  },
  dashboard: {
    title: 'Dashboard',
    description:
      'Your personal chess dashboard. Track your Elo rating, review recent games, manage challenges, and jump straight back into online play.',
  },
  profile: {
    title: 'Profile',
    description:
      'Manage your personal chess profile. Update your username, avatar, and account details to keep your Play Chess identity up to date.',
  },
  membership: {
    title: 'Membership',
    description:
      'Upgrade your membership to unlock premium chess features, including advanced game analysis, deeper statistics, and an ad-free experience.',
  },
  play: {
    online: {
      title: 'Play Online',
      description:
        'Play chess online in real time. Get matched with opponents at your skill level and start a free rated game in seconds.',
    },
  },
  game: {
    title: 'Game',
    description:
      'Play your live chess match in real time, follow every move as it happens, and review the full game afterward with complete move history.',
  },
  games: {
    title: 'Games',
    description:
      'Browse your full chess game history. Replay past matches move by move, analyze your decisions, and track your progress over time.',
  },
  friends: {
    title: 'Friends',
    description:
      'Connect with friends on Play Chess. Send and accept friend requests, challenge them to real-time games, and manage your blocked list.',
  },
  leaderboard: {
    title: 'Leaderboard',
    description:
      'Explore the Play Chess leaderboard. See the top-rated players ranked by Elo, follow live rankings, and discover who leads the global standings.',
  },
  challenges: {
    title: 'Challenges',
    description:
      'View and respond to incoming chess challenges. Accept or decline game invites and start real-time matches against other players instantly.',
  },
  member: {
    title: 'Member',
    description:
      "Explore a chess player's profile, Elo rating, and match statistics. View their game history and performance in real-time online chess.",
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
      description:
        'Sign in to Play Chess to play online chess, challenge friends, climb the leaderboard, and pick up your games right where you left off.',
    },
    signUp: {
      title: 'Sign Up',
      description:
        'Create a free Play Chess account. Play online chess in real time, challenge friends, climb the leaderboard, and track your Elo rating.',
    },
    forgotPassword: {
      title: 'Forgot Password',
      description:
        'Forgot your password? Reset it securely and regain access to your Play Chess account to get back to playing online chess.',
    },
    resetPassword: {
      title: 'Reset Password',
      description:
        'Create a new password for your Play Chess account and securely regain access to your games, friends, and rating.',
    },
    twoFactor: {
      title: 'Two-Factor Authentication',
      description:
        'Enter your two-factor authentication code to securely verify your identity and access your Play Chess account.',
    },
  },
  goodbye: {
    title: 'Account Deleted',
    description:
      "Your Play Chess account has been successfully deleted. We're sorry to see you go, and you're always welcome back to play again.",
  },
  notFound: {
    title: '404 - Page Not Found',
    description:
      "The page you're looking for could not be found. Head back to Play Chess to keep playing online chess and challenging friends.",
  },
  error: {
    title: 'Error',
    description:
      'Something went wrong while processing your request. Please try again, or return to Play Chess to continue your game.',
  },
};
