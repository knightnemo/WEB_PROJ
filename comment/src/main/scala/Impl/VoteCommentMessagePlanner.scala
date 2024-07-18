  package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class VoteCommentMessagePlanner(
                                      commentId: String,
                                      userId: String,
                                      voteType: String,
                                      override val planContext: PlanContext
                                    ) extends Planner[Boolean]:

  override def plan(using PlanContext): IO[Boolean] = {
    val (column, otherColumn) = voteType match {
      case "upvote" => ("upvotes", "downvotes")
      case "downvote" => ("downvotes", "upvotes")
      case _ => throw new IllegalArgumentException("Invalid vote type")
    }

    for {
      _ <- writeDB(
        s"""UPDATE ${schemaName}.comments
           |SET $column = $column + 1,
           |    $otherColumn = CASE WHEN $otherColumn > 0 THEN $otherColumn - 1 ELSE 0 END
           |WHERE id = ?""".stripMargin,
        List(SqlParameter("String", commentId))
      )
      _ <- writeDB(
        s"""INSERT INTO ${schemaName}.comment_votes (comment_id, user_id, vote_type)
           |VALUES (?, ?, ?)
           |ON CONFLICT (comment_id, user_id) DO UPDATE SET vote_type = ?""".stripMargin,
        List(
          SqlParameter("String", commentId),
          SqlParameter("String", userId),
          SqlParameter("String", voteType),
          SqlParameter("String", voteType)
        )
      )
    } yield true
  }.handleErrorWith(_ => IO.pure(false))