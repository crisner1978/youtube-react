export const getIsLiked = async (req, prisma) =>
  await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: 1,
      },
    },
  });

export const getIsDisliked = async (req, prisma) =>
  await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: -1,
      },
    },
  });


  export const getIsViewed = async (prisma, req, video) => await prisma.view.findFirst({
    where: {
      userId: {
        equals: req.user.id
      },
      videoId: {
        equals: video.id
      }
    }
  })
  
  export const getIsSubscribed = async (prisma, req, video) => await prisma.subscription.findFirst({
    where: {
      subscriberId: {
        equals: req.user.id
      },
      subscribedToId: {
        equals: video.userId
      }
    }
  })

export const getLikeCount = async (prisma, req) => await prisma.videoLike.count({
  where: {
    AND: {
      videoId: {
        equals: req.params.videoId
      },
      like: {
        equals: 1
      }
    }
  }
})

export const getDislikeCount = async (prisma, req) => await prisma.videoLike.count({
  where: {
    AND: {
      videoId: {
        equals: req.params.videoId
      },
      like: {
        equals: -1
      }
    }
  }
})

export const getViewCount = async (prisma, video) => await prisma.view.count({
  where: {
    videoId: {
      equals: video.id,
    },
  },
});

export const getSubscriberCount = async (prisma, video) => await prisma.subscription.count({
  where: {
    subscribedToId: {
      equals: video.userId
    }
  }
})
