package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.CommentAPI.DeleteCommentMessage

case class DeleteCommentMessagePlanner(msg: DeleteCommentMessage, override val planContext: PlanContext) extends Planner[Boolean]:
  override def plan(using planContext: PlanContext): IO[Boolean] = {
    // 首先删除所有子评论
    val deleteChildrenQuery = s"DELETE FROM ${schemaName}.comments WHERE parent_id = ?"
    val deleteChildrenParams = List(SqlParameter("String", msg.id))

    // 然后删除主评论
    val deleteMainCommentQuery = s"DELETE FROM ${schemaName}.comments WHERE id = ?"
    val deleteMainCommentParams = List(SqlParameter("String", msg.id))

    for {
      // 删除子评论
      _ <- writeDB(deleteChildrenQuery, deleteChildrenParams)
      // 删除主评论
      result <- writeDB(deleteMainCommentQuery, deleteMainCommentParams)
    } yield result > "0"
  }