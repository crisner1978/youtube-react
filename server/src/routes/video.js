import express from "express";
import { PrismaClient } from "@prisma/client";
import getVideoViews from "../utils/getVideoViews";
import { getAuthUser, protect } from "../middleware/authorization";
import { getDislikeCount, getIsDisliked, getIsLiked, getIsSubscribed, getIsViewed, getLikeCount, getSubscriberCount, getViewCount } from "../utils/videoHelpers";

const prisma = new PrismaClient();

export function getVideoRoutes() {
  const router = express.Router();

  router.get("/", getRecommendedVideos);
  router.post("/", protect, addVideo);

  router.get("/search", searchVideos);
  router.get("/trending", getTrendingVideos);

  router.get("/:videoId", getAuthUser, getVideo);
  router.delete("/:videoId", protect, deleteVideo)

  router.get("/:videoId/dislike", protect, dislikeVideo);
  router.get("/:videoId/like", protect, likeVideo);
  router.get("/:videoId/view", getAuthUser, addVideoView);
  
  router.post("/:videoId/comments", protect, addComment);
  router.delete("/:videoId/comments/:commentId", protect, deleteComment);

  return router;
}

async function getRecommendedVideos(req, res) {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!videos.length) {
    return res.status(200).json({ videos });
  }

  videos = await getVideoViews(videos, prisma);

  res.status(200).json({ videos });
}

async function getTrendingVideos(req, res) {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!videos.length) {
    return res.status(200).json({ videos });
  }

  videos = await getVideoViews(videos, prisma);
  videos.sort((a, b) => b.views - a.views);

  res.status(200).json({ videos });
}

async function searchVideos(req, res, next) {
  if (!req.query.find) {
    return next({
      message: "Please enter a search a valid query",
      statusCode: 400,
    });
  }

  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    where: {
      OR: [
        {
          title: {
            contains: req.query.find,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: req.query.find,
            mode: "insensitive",
          },
        },
      ],
    },
  });

  if (!videos.length) {
    return res.status(200).json({ videos });
  }

  videos = await getVideoViews(videos, prisma);

  res.status(200).json({ videos });
}

async function addVideo(req, res) {
  const { title, description, url, thumbnail } = req.body;

  const video = await prisma.video.create({
    data: {
      title,
      description,
      url,
      thumbnail,
      user: {
        connect: {
          id: req.user.id,
        },
      },
    },
  });
  res.status(200).json({ video });
}

async function addComment(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });

  if (!video) {
    return next({
      message: `No video found with id: "${req.params.videoId}"`,
      statusCode: 404,
    });
  }

  const comment = await prisma.comment.create({
    data: {
      text: req.body.text,
      user: {
        connect: {
          id: req.user.id,
        },
      },
      video: {
        connect: {
          id: req.params.videoId,
        },
      },
    },
  });

  res.status(200).json({ comment });
}

async function deleteComment(req, res) {
  const comment = await prisma.comment.findUnique({
    where: {
      id: req.params.commentId,
    },
    select: {
      userId: true,
    },
  });

  if (comment.userId !== req.user.id) {
    return res
      .status(401)
      .send("You are not authorized to delete this comment");
  }

  await prisma.comment.delete({
    where: {
      id: req.params.commentId,
    },
  });

  res.status(200).json({});
}

async function addVideoView(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });

  if (!video) {
    return next({
      message: `No video found with id: "${req.params.videoId}"`,
      statusCode: 404,
    });
  }

  if (req.user) {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        user: {
          connect: {
            id: req.user.id,
          },
        },
      },
    });
  } else {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
      },
    });
  }
  res.status(200).json({});
}

async function likeVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });

  if (!video) {
    return next({
      message: `No video found with id: "${req.params.videoId}"`,
      statusCode: 404,
    });
  }

  const isLiked = await Liked(req, prisma);
  const isDisliked = await Disliked(req, prisma);

  if (isLiked) {
    await prisma.videoLike.delete({
      where: {
        id: isLiked.id,
      },
    });
  } else if (isDisliked) {
    await prisma.videoLike.update({
      where: {
        id: isDisliked.id,
      },
      data: {
        like: 1,
      },
    });
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        like: 1,
      },
    });
  }

  res.status(200).json({});
}

async function dislikeVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });

  if (!video) {
    return next({
      message: `No video found with id: "${req.params.videoId}"`,
      statusCode: 404,
    });
  }

  const isLiked = await Liked(req, prisma);
  const isDisliked = await Disliked(req, prisma);

  if (isDisliked) {
    await prisma.videoLike.delete({
      where: {
        id: isDisliked.id,
      },
    });
  } else if (isLiked) {
    await prisma.videoLike.update({
      where: {
        id: isLiked.id,
      },
      data: {
        like: -1,
      },
    });
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        like: -1,
      },
    });
  }

  res.status(200).json({});
}

async function getVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
    include: {
      user: true,
      comments: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!video) {
    return next({
      message: `No video found with id: "${req.params.videoId}"`,
      statusCode: 404,
    });
  }

  let isVideoMine = false;
  let isLiked = false;
  let isDisliked = false;
  let isSubscribed = false;
  let isViewed = false;

  if (req.user) {
    isVideoMine = req.user.id === video.userId;
    isDisliked = await getIsDisliked(req, prisma);
    isLiked = await getIsLiked(req, prisma);
    isViewed = await getIsViewed(prisma, req, video);
    isSubscribed = await getIsSubscribed(prisma, req, video);
  }

  const likesCount = await getLikeCount(prisma, req);
  const dislikesCount = await getDislikeCount(prisma, req);
  const views = await getViewCount(prisma, video);
  const subscribersCount = await getSubscriberCount(prisma, video);

  video.commentsCount = video.comments.length;
  video.isLiked = Boolean(isLiked);
  video.isDisliked = Boolean(isDisliked);
  video.likesCount = likesCount;
  video.dislikesCount = dislikesCount;
  video.isVideoMine = isVideoMine;
  video.isSubscribed = Boolean(isSubscribed);
  video.views = views;
  video.isViewed = Boolean(isViewed);
  video.subscribersCount = subscribersCount;

  res.status(200).json({ video });
}

async function deleteVideo(req, res) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId
    },
    select: {
      userId: true
    }
  })

  if (req.user.id !== video.userId) {
    return res.status(401).send("You are not authorized to delete this video")
  }

  await prisma.view.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId
      }
    }
  })
  await prisma.videoLike.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId
      }
    }
  })
  await prisma.comment.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId
      }
    }
  })
  await prisma.video.delete({
    where: {
      id: req.params.videoId
    }
  })

  res.status(200).json({})
}
