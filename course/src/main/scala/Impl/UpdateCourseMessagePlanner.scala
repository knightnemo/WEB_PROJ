package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName

case class UpdateCourseMessagePlanner(id: String, title: Option[String], instructor: Option[String], description: Option[String], rating: Option[Double], reviews: Option[Int], imageUrl: Option[String], override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    val updates = List(
      title.map(t => (s"title = ?", SqlParameter("String", t))),
      instructor.map(i => (s"instructor = ?", SqlParameter("String", i))),
      description.map(d => (s"description = ?", SqlParameter("String", d))),
      rating.map(r => (s"rating = ?", SqlParameter("String", r.toString))),
      reviews.map(rv => (s"reviews = ?", SqlParameter("String", rv.toString))),
      imageUrl.map(url => (s"image_url = ?", SqlParameter("String", url)))
    ).flatten

    if (updates.isEmpty) {
      IO.pure("No updates provided")
    } else {
      val (setClause, params) = updates.unzip
      val query = s"UPDATE ${schemaName}.courses SET ${setClause.mkString(", ")} WHERE id = ?"
      val allParams = params :+ SqlParameter("String", id)

      writeDB(query, allParams).map(_ => s"Course updated successfully for ID: $id")
    }
  }