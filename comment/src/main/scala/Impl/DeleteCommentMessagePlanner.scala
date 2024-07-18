package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class DeleteCommentMessagePlanner(
                                        commentId: String,
                                        override val planContext: PlanContext
                                      ) extends Planner[Boolean]:

  override def plan(using PlanContext): IO[Boolean] = {
    writeDB(
      s"DELETE FROM ${schemaName}.comments WHERE id = ?",
      List(SqlParameter("String", commentId))
    ).map(_ => true)
      .handleErrorWith(_ => IO.pure(false))
  }